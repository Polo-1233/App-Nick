//
// SharedDefaultsModule.m
// R90Navigator
//

#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(SharedDefaultsModule, NSObject)

RCT_EXTERN_METHOD(set:(NSString *)key
                  value:(NSString *)value
                  suiteName:(NSString *)suiteName)

RCT_EXTERN_METHOD(reloadAllTimelines)
