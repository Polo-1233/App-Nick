//
// SharedDefaultsModule.swift
// R90Navigator
//
// Native module that exposes App Group UserDefaults to React Native.
// Allows the JS layer to write widget data to shared storage so the
// R90Widget WidgetKit extension can read it without IPC overhead.
//
// App Group:  group.com.metalab.r90navigator
// JSON key:   widgetData
//

import Foundation
import WidgetKit

@objc(SharedDefaultsModule)
class SharedDefaultsModule: NSObject {

  /// Write a string value to shared App Group UserDefaults.
  ///
  /// - Parameters:
  ///   - key:       The UserDefaults key (e.g. "widgetData")
  ///   - value:     A JSON string produced by the JS layer
  ///   - suiteName: The App Group identifier (e.g. "group.com.metalab.r90navigator")
  @objc(set:value:suiteName:)
  func set(_ key: String, value: String, suiteName: String) {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      print("[SharedDefaultsModule] ⚠️  Could not open suite: \(suiteName)")
      return
    }
    defaults.set(value, forKey: key)
    defaults.synchronize()
  }

  /// Ask WidgetKit to reload all widget timelines immediately.
  /// Call this after writing new data so the widget refreshes without delay.
  @objc func reloadAllTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
