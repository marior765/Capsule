// Jest setup for render tests (10.38). Runs after react-native-unistyles'
// own mock (listed before this file in package.json's jest.setupFiles):
// importing the app's unistyles config registers the real light/dark themes
// with the mocked StyleSheet, so `StyleSheet.create((theme) => …)` in
// widgets resolves against the app's actual tokens, not an empty theme.
//
// The theme registry lives inside the mocked module. A test that calls
// jest.resetModules() or jest.isolateModules() and then imports a styled
// widget gets a fresh, empty registry (theme.spacing is undefined); such a
// test must import "@/shared/ui/unistyles" again inside the isolated scope.
import "@/shared/ui/unistyles";
