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
  NSMutableArray<AVSpeechSynthesisVoice *> *zhVoices = [NSMutableArray array];
  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh"]) {
      [zhVoices addObject:v];
    }
  }

  NSArray<AVSpeechSynthesisVoice *> *sorted = [zhVoices sortedArrayUsingComparator:^NSComparisonResult(AVSpeechSynthesisVoice *a, AVSpeechSynthesisVoice *b) {
    if (a.quality > b.quality) return NSOrderedAscending;
    if (a.quality < b.quality) return NSOrderedDescending;
    return NSOrderedSame;
  }];

  if (sorted.count > 0) {
    AVSpeechSynthesisVoice *best = sorted[0];
    TTSLog(@"selected best voice: %@ (id=%@, quality=%ld)", best.name, best.identifier, (long)best.quality);
    return best;
  }

  AVSpeechSynthesisVoice *fallback = [AVSpeechSynthesisVoice voiceWithLanguage:@"zh-CN"];
  TTSLog(@"fallback voice: %@ (id=%@)", fallback.name, fallback.identifier);
  return fallback;
}

static float rateToAVRate(float rateF) {
  if (rateF == 0) {
    return AVSpeechUtteranceDefaultSpeechRate;
  } else if (rateF > 0) {
    return AVSpeechUtteranceDefaultSpeechRate +
      rateF * (AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceDefaultSpeechRate) / 100.0;
  } else {
    return AVSpeechUtteranceMinimumSpeechRate +
      (-rateF) * (AVSpeechUtteranceDefaultSpeechRate - AVSpeechUtteranceMinimumSpeechRate) / 100.0;
  }
}

@interface TTSWriter ()
@property (nonatomic, strong) AVSpeechSynthesizer *previewSynth;
@end

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
    utterance.rate = rateToAVRate(rateF);

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

RCT_EXPORT_METHOD(previewVoice:(NSString *)voiceId
                           rate:(nonnull NSNumber *)rateVal
                           text:(NSString *)text
                      resolver:(RCTPromiseResolveBlock)resolve
                      rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self.previewSynth) {
      self.previewSynth = [[AVSpeechSynthesizer alloc] init];
    }
    [self.previewSynth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];

    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text.length > 0 ? text : @""];
    utterance.voice = selectVoice(voiceId);
    utterance.rate = rateToAVRate([rateVal floatValue]);

    TTSLog(@"previewVoice: voice=%@ (id=%@), rate=%.1f->%.2f, text=%lu chars",
           utterance.voice.name, utterance.voice.identifier,
           [rateVal floatValue], utterance.rate, (unsigned long)utterance.speechString.length);

    [self.previewSynth speak:utterance];
    resolve(@{ @"success": @YES });
  });
}

RCT_EXPORT_METHOD(getVoices:(RCTPromiseResolveBlock)resolve
                       rejecter:(RCTPromiseRejectBlock)reject)
{
  NSArray<AVSpeechSynthesisVoice *> *voices = [AVSpeechSynthesisVoice speechVoices];
  NSMutableArray<NSMutableDictionary *> *zhVoices = [NSMutableArray array];

  for (AVSpeechSynthesisVoice *v in voices) {
    if (![v.language hasPrefix:@"zh"]) continue;

    NSString *qualityStr;
    switch (v.quality) {
      case AVVoiceQualityPremium: qualityStr = @"premium"; break;
      case AVVoiceQualityEnhanced: qualityStr = @"enhanced"; break;
      case AVVoiceQualityCompact:  qualityStr = @"compact"; break;
      default:                     qualityStr = @"default"; break;
    }

    [zhVoices addObject:[NSMutableDictionary dictionaryWithDictionary:@{
      @"identifier": v.identifier ?: @"",
      @"name": v.name ?: @"",
      @"language": v.language ?: @"",
      @"quality": qualityStr,
      @"_qv": @(v.quality),
      @"downloaded": @YES,
    }]];
  }

  [zhVoices sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    NSInteger qa = [a[@"_qv"] integerValue];
    NSInteger qb = [b[@"_qv"] integerValue];
    if (qa > qb) return NSOrderedAscending;
    if (qa < qb) return NSOrderedDescending;
    return NSOrderedSame;
  }];

  NSMutableArray *result = [NSMutableArray array];
  for (NSMutableDictionary *d in zhVoices) {
    [d removeObjectForKey:@"_qv"];
    [result addObject:d];
  }

  TTSLog(@"getVoices: returning %lu zh voices (sorted by quality desc)", (unsigned long)result.count);
  resolve(result);
}

@end
