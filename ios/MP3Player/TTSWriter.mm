#import "TTSWriter.h"
#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

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

    AVSpeechSynthesizer *synthesizer = [[AVSpeechSynthesizer alloc] init];

    // AVAudioFile must be created with the voice's recommended settings
    // (format id, sample rate, channel count). commonFormat:Float32
    // non-interleaved matches the buffer format the synthesizer delivers
    // (per AVSpeechSynthesis.h: "The data provided by
    // AVSpeechSynthesizerBufferCallback will be in this specified format
    // when using this voice"). Marked __block so the callback can
    // explicitly release it (and close the AIFF file) before kicking off
    // the async M4A export.
    __block AVAudioFile *audioFile = nil;
    NSDictionary *settings = utterance.voice.audioFileSettings;
    NSError *fileErr = nil;
    audioFile = [[AVAudioFile alloc] initForWriting:aiffURL
                                            settings:settings
                                        commonFormat:AVAudioPCMFormatFloat32
                                         interleaved:NO
                                              error:&fileErr];
    if (!audioFile) {
      reject(@"tts_write_failed", @"无法创建音频文件", fileErr);
      return;
    }

    [synthesizer writeUtterance:utterance
               toBufferCallback:^(AVAudioBuffer *buffer) {
      // aiffURL, m4aURL, outputPath, resolve, reject are captured by the
      // block, which is retained by AVSpeechSynthesizer for the duration
      // of synthesis - no extra lifetime management needed. AVAudioFile
      // operations are serialized on the synthesizer's callback queue,
      // so writeFromBuffer: is safe to call from here.
      if (buffer) {
        // Non-nil buffer = a chunk of PCM data. Cast to AVAudioPCMBuffer
        // and append to the AIFF file. The buffer format matches the
        // file format (same voice settings + Float32 non-interleaved)
        // so no conversion is required.
        NSError *writeErr = nil;
        AVAudioPCMBuffer *pcm = (AVAudioPCMBuffer *)buffer;
        if (![audioFile writeFromBuffer:pcm error:&writeErr]) {
          RCTLogError(@"TTSWriter writeFromBuffer failed: %@", writeErr);
        }
        return;
      }

      // nil buffer = synthesis complete. Release the AVAudioFile first
      // so it flushes/closes the AIFF file before the exporter reads it.
      audioFile = nil;

      // Convert AIFF -> M4A.
      AVAsset *asset = [AVAsset assetWithURL:aiffURL];
      AVAssetExportSession *exporter = [AVAssetExportSession
          exportSessionWithAsset:asset
                       presetName:AVAssetExportPresetAppleM4A];
      if (!exporter) {
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        reject(@"tts_convert_init_failed", @"无法创建音频转换器", nil);
        return;
      }
      exporter.outputURL = m4aURL;
      exporter.outputFileType = AVFileTypeAppleM4A;

      [exporter exportAsynchronouslyWithCompletionHandler:^{
        [[NSFileManager defaultManager] removeItemAtURL:aiffURL error:nil];
        if (exporter.status == AVAssetExportSessionStatusCompleted) {
          resolve(@{ @"success": @YES, @"path": outputPath });
        } else {
          reject(@"tts_convert_failed", @"音频转换失败", exporter.error);
        }
      }];
    }];
  });
}

@end
