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
  NSString *line = [NSString stringWithFormat:@"[TTSWriter][%@] %@\n", ts, msg];

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

static AVSpeechSynthesisVoice *selectVoice(NSString *voiceId) {
  if (voiceId.length > 0) {
    AVSpeechSynthesisVoice *v = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
    if (v) {
      TTSLog(@"using voice by identifier: %@ (%@)", voiceId, v.name);
      return v;
    }
  }

  NSArray<AVSpeechSynthesisVoice *> *allVoices = [AVSpeechSynthesisVoice speechVoices];

  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh-CN"] &&
        [v.identifier containsString:@"premium"]) {
      TTSLog(@"selected premium voice: %@ (id=%@)", v.name, v.identifier);
      return v;
    }
  }

  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh-Hans"] &&
        [v.identifier containsString:@"premium"]) {
      TTSLog(@"selected premium voice: %@ (id=%@)", v.name, v.identifier);
      return v;
    }
  }

  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh-CN"] &&
        [v.identifier containsString:@"enhanced"]) {
      TTSLog(@"selected enhanced voice: %@ (id=%@)", v.name, v.identifier);
      return v;
    }
  }

  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh-Hans"] &&
        [v.identifier containsString:@"enhanced"]) {
      TTSLog(@"selected enhanced voice: %@ (id=%@)", v.name, v.identifier);
      return v;
    }
  }

  AVSpeechSynthesisVoice *fallback = [AVSpeechSynthesisVoice voiceWithLanguage:@"zh-CN"];
  TTSLog(@"fallback voice: %@ (id=%@)", fallback.name, fallback.identifier);
  return fallback;
}

@implementation TTSWriter

RCT_EXPORT_MODULE(TTSWriter);

RCT_EXPORT_METHOD(synthesize:(NSString *)text
                      outputPath:(NSString *)outputPath
                        voiceId:(NSString *)voiceId
                           rate:(nonnull NSNumber *)rateVal
                       resolver:(RCTPromiseResolveBlock)resolve
                       rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *aiffPath = [[outputPath stringByDeletingPathExtension] stringByAppendingString:@".aiff"];
    NSURL *aiffURL = [NSURL fileURLWithPath:aiffPath];
    NSURL *m4aURL = [NSURL fileURLWithPath:outputPath];

    [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
    [[NSFileManager defaultManager] removeItemAtURL:m4aURL error:nil];

    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text];
    utterance.voice = selectVoice(voiceId);

    float rateF = [rateVal floatValue];
    if (rateF == 0) {
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate;
    } else if (rateF > 0) {
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate +
        rateF * (AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceDefaultSpeechRate) / 100.0;
    } else {
      utterance.rate = AVSpeechUtteranceMinimumSpeechRate +
        (-rateF) * (AVSpeechUtteranceDefaultSpeechRate - AVSpeechUtteranceMinimumSpeechRate) / 100.0;
    }

    TTSLog(@"synthesize: text=%lu chars, voice=%@ (id=%@), rate=%.1f->%.2f, output=%@",
           (unsigned long)text.length,
           utterance.voice.name, utterance.voice.identifier,
           rateF, utterance.rate, outputPath);

    AVSpeechSynthesizer *synthesizer = [[AVSpeechSynthesizer alloc] init];
    __block __strong AVSpeechSynthesizer *synthesizerRetain = synthesizer;

    __block UIBackgroundTaskIdentifier bgTask = UIBackgroundTaskInvalid;
    void (^endBackgroundTask)(void) = ^{
      if (bgTask != UIBackgroundTaskInvalid) {
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
      }
    };
    bgTask = [[UIApplication sharedApplication]
        beginBackgroundTaskWithExpirationHandler:^{
          TTSLog(@"background task expired");
          synthesizerRetain = nil;
          endBackgroundTask();
        }];

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
    __block BOOL completionHandled = NO;

    [synthesizer writeUtterance:utterance
               toBufferCallback:^(AVAudioBuffer *buffer) {
      BOOL isComplete = NO;
      if (!buffer) {
        isComplete = YES;
        TTSLog(@"nil buffer (complete), total buffers=%ld", (long)bufferCount);
      } else {
        AVAudioPCMBuffer *pcm = (AVAudioPCMBuffer *)buffer;
        if (pcm.frameLength == 0) {
          isComplete = YES;
          TTSLog(@"zero-length buffer (complete), total buffers=%ld", (long)bufferCount);
        } else {
          bufferCount++;
          NSError *writeErr = nil;
          if (![audioFile writeFromBuffer:pcm error:&writeErr]) {
            TTSLog(@"writeFromBuffer failed: %@", writeErr);
          }
          if (bufferCount == 1 || bufferCount % 100 == 0) {
            TTSLog(@"buffer #%ld, frames=%lu", (long)bufferCount,
                   (unsigned long)pcm.frameLength);
          }
          return;
        }
      }

      if (completionHandled) return;
      completionHandled = YES;

      audioFile = nil;
      synthesizerRetain = nil;

      AVAsset *asset = [AVAsset assetWithURL:aiffURL];
      AVAssetExportSession *exporter = [AVAssetExportSession
          exportSessionWithAsset:asset
                       presetName:AVAssetExportPresetAppleM4A];
      if (!exporter) {
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        endBackgroundTask();
        reject(@"tts_convert_init_failed", @"无法创建M4A转换器", nil);
        return;
      }
      exporter.outputURL = m4aURL;
      exporter.outputFileType = AVFileTypeAppleM4A;
      TTSLog(@"converting AIFF->M4A");

      [exporter exportAsynchronouslyWithCompletionHandler:^{
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        if (exporter.status == AVAssetExportSessionStatusCompleted) {
          TTSLog(@"M4A export done, path=%@", outputPath);
          endBackgroundTask();
          resolve(@{ @"success": @YES, @"path": outputPath });
        } else {
          TTSLog(@"M4A export failed: %ld %@", (long)exporter.status, exporter.error);
          endBackgroundTask();
          reject(@"tts_convert_failed", @"M4A转换失败", exporter.error);
        }
      }];
    }];
  });
}

RCT_EXPORT_METHOD(getVoices:(RCTPromiseResolveBlock)resolve
                       rejecter:(RCTPromiseRejectBlock)reject)
{
  NSMutableArray *result = [NSMutableArray array];
  NSArray<AVSpeechSynthesisVoice *> *voices = [AVSpeechSynthesisVoice speechVoices];

  for (AVSpeechSynthesisVoice *v in voices) {
    if (![v.language hasPrefix:@"zh"]) continue;
    [result addObject:@{
      @"identifier": v.identifier ?: @"",
      @"name": v.name ?: @"",
      @"language": v.language ?: @"",
      @"quality": ([v.identifier containsString:@"premium"]) ? @"premium" :
                  ([v.identifier containsString:@"enhanced"]) ? @"enhanced" : @"compact",
    }];
  }

  TTSLog(@"getVoices: returning %lu zh voices", (unsigned long)result.count);
  resolve(result);
}

@end
