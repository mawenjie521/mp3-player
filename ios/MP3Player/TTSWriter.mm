#import "TTSWriter.h"
#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

static void TTSLog(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSString *msg = [[NSString alloc] initWithFormat:format arguments:args];
  va_end(args);

  NSDateFormatter *fmt = [[NSDateFormatter alloc] init];
  fmt.dateFormat = @"HH:mm:ss.SSS";
  NSString *ts = [fmt stringFromDate:[NSDate date]];
  NSString *line = [NSString stringWithFormat:@"[%@] %@\n", ts, msg];

  NSString *docs = [NSSearchPathForDirectoriesInDomains(
      NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
  NSString *logPath = [docs stringByAppendingPathComponent:@"tts-debug.log"];

  @synchronized([TTSWriter class]) {
    if (![[NSFileManager defaultManager] fileExistsAtPath:logPath]) {
      [line writeToFile:logPath atomically:YES
             encoding:NSUTF8StringEncoding error:nil];
    } else {
      NSFileHandle *fh = [NSFileHandle fileHandleForWritingAtPath:logPath];
      if (fh) {
        [fh seekToEndOfFile];
        [fh writeData:[line dataUsingEncoding:NSUTF8StringEncoding]];
        [fh closeFile];
      }
    }
  }
  RCTLogInfo(@"%@", line);
}

@implementation TTSWriter

RCT_EXPORT_MODULE(TTSWriter);

RCT_EXPORT_METHOD(synthesize:(NSString *)text
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *aiffPath = [[outputPath stringByDeletingPathExtension] stringByAppendingString:@".aiff"];
    NSURL *aiffURL = [NSURL fileURLWithPath:aiffPath];
    NSURL *m4aURL = [NSURL fileURLWithPath:outputPath];

    // Remove any pre-existing files at these paths.
    [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
    [[NSFileManager defaultManager] removeItemAtURL:m4aURL error:nil];

    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text];
    utterance.voice = [AVSpeechSynthesisVoice voiceWithLanguage:@"zh-CN"];
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate;

    TTSLog(@"synthesize called, text=%lu chars, voice=%@, aiff=%@",
           (unsigned long)text.length,
           utterance.voice ? utterance.voice.language : @"nil",
           aiffPath);

    // AVSpeechSynthesizer must be retained for the duration of synthesis.
    // writeUtterance:toBufferCallback: returns immediately and schedules
    // synthesis on a background queue; if the synthesizer is released,
    // synthesis is cancelled and the callback is never invoked.
    // __block storage lets the callback hold the synthesizer alive via a
    // retain cycle that is broken when the callback sets it to nil on
    // synthesis completion.
    AVSpeechSynthesizer *synthesizer = [[AVSpeechSynthesizer alloc] init];
    __block __strong AVSpeechSynthesizer *synthesizerRetain = synthesizer;

    // Request background processing time so synthesis and the AIFF->M4A
    // export can finish even if the app is briefly backgrounded. iOS gives
    // ~30s; synthesis + export typically takes 2-3s.
    __block UIBackgroundTaskIdentifier bgTask = UIBackgroundTaskInvalid;
    void (^endBackgroundTask)(void) = ^{
      if (bgTask != UIBackgroundTaskInvalid) {
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
      }
    };
    bgTask = [[UIApplication sharedApplication]
        beginBackgroundTaskWithExpirationHandler:^{
          TTSLog(@"background task expired - force cleanup");
          synthesizerRetain = nil;
          endBackgroundTask();
        }];

    // AVAudioFile must be created with the voice's recommended settings
    // (format id, sample rate, channel count). commonFormat:Float32
    // non-interleaved matches the buffer format the synthesizer delivers.
    __block AVAudioFile *audioFile = nil;
    NSDictionary *settings = utterance.voice.audioFileSettings;
    NSError *fileErr = nil;
    audioFile = [[AVAudioFile alloc] initForWriting:aiffURL
                                            settings:settings
                                        commonFormat:AVAudioPCMFormatFloat32
                                         interleaved:NO
                                              error:&fileErr];
    if (!audioFile) {
      synthesizerRetain = nil;
      endBackgroundTask();
      reject(@"tts_write_failed", @"无法创建音频文件", fileErr);
      return;
    }

    __block NSInteger bufferCount = 0;
    // The synthesizer may deliver the completion signal (zero-length or nil
    // buffer) more than once. Guard against duplicate export/promise calls.
    __block BOOL completionHandled = NO;

    [synthesizer writeUtterance:utterance
               toBufferCallback:^(AVAudioBuffer *buffer) {
      // Completion is signaled by either a nil buffer (standard contract)
      // or a zero-length buffer. On iOS 18, the synthesizer sends a
      // zero-length buffer as the final callback and may not deliver a
      // subsequent nil buffer; treating only nil as completion causes the
      // promise to hang forever and the AIFF file to never be closed.
      BOOL isComplete = NO;
      if (!buffer) {
        isComplete = YES;
        TTSLog(@"nil buffer received (synthesis complete), total buffers=%ld",
               (long)bufferCount);
      } else {
        AVAudioPCMBuffer *pcm = (AVAudioPCMBuffer *)buffer;
        if (pcm.frameLength == 0) {
          isComplete = YES;
          TTSLog(@"zero-length buffer received (treating as complete), total buffers=%ld",
                 (long)bufferCount);
        } else {
          bufferCount++;
          NSError *writeErr = nil;
          if (![audioFile writeFromBuffer:pcm error:&writeErr]) {
            TTSLog(@"writeFromBuffer failed: %@", writeErr);
          }
          if (bufferCount == 1 || bufferCount % 100 == 0) {
            TTSLog(@"buffer #%ld, frameLength=%lu, totalFrames~=%lu",
                   (long)bufferCount,
                   (unsigned long)pcm.frameLength,
                   (unsigned long)(bufferCount * pcm.frameLength));
          }
          return;
        }
      }

      if (completionHandled) {
        return;
      }
      completionHandled = YES;

      // Release the AVAudioFile first so it flushes/closes the AIFF file
      // before the exporter reads it.
      audioFile = nil;
      // Release the synthesizer to break the retain cycle.
      synthesizerRetain = nil;

      // Convert AIFF -> M4A.
      AVAsset *asset = [AVAsset assetWithURL:aiffURL];
      AVAssetExportSession *exporter = [AVAssetExportSession
          exportSessionWithAsset:asset
                       presetName:AVAssetExportPresetAppleM4A];
      if (!exporter) {
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        endBackgroundTask();
        reject(@"tts_convert_init_failed", @"无法创建音频转换器", nil);
        return;
      }
      exporter.outputURL = m4aURL;
      exporter.outputFileType = AVFileTypeAppleM4A;
      TTSLog(@"starting M4A export to %@", outputPath);

      [exporter exportAsynchronouslyWithCompletionHandler:^{
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        if (exporter.status == AVAssetExportSessionStatusCompleted) {
          TTSLog(@"export completed, path=%@", outputPath);
          endBackgroundTask();
          resolve(@{ @"success": @YES, @"path": outputPath });
        } else {
          TTSLog(@"export failed status=%ld error=%@",
                      (long)exporter.status, exporter.error);
          endBackgroundTask();
          reject(@"tts_convert_failed", @"音频转换失败", exporter.error);
        }
      }];
    }];
  });
}

@end
