//
// SharedDefaultsModule.m
// R90Navigator
//
// Objective-C bridge registration for the SharedDefaults Swift module.
// This file is required so React Native can discover the module via the
// legacy RCTBridgeModule / RCT_EXTERN_MODULE mechanism.
//
// DO NOT rename this file — it must match the Swift class name below.
//

#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(SharedDefaultsModule, NSObject)

// void set(key: String, value: String, suiteName: String)
RCT_EXTERN_METHOD(
  set:(NSString *)key
  value:(NSString *)value
  suiteName:(NSString *)suiteName
)

// void reloadAllTimelines()
RCT_EXTERN_METHOD(reloadAllTimelines)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}
