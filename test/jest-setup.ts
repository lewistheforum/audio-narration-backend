/**
 * Jest Global Setup
 * This file runs before all test suites to configure the testing environment
 */

// Force Node.js to use Asia/Ho_Chi_Minh timezone for all tests
// This ensures tests run consistently regardless of the developer's local timezone
process.env.TZ = 'Asia/Ho_Chi_Minh';
