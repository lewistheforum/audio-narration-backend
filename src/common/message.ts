const statusCode = {
  success: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  userError: 405,
  internalError: 500,
};

const successMessage = {
  index: 'SUCCESS',
  server: 'Server is running',
  // User Management
  userFetchSuccess: 'Users fetched successfully',
  userCreateSuccess: 'User created successfully',
  userUpdateSuccess: 'User updated successfully',
  userDeleteSuccess: 'User deleted successfully',
  userBannedSuccess: 'User banned successfully',
  userUnbannedSuccess: 'User unbanned successfully',
  userRestoredSuccess: 'User restored successfully',
  // Authentication
  loginSuccess: 'User logged in successfully',
  googleLoginSuccess: 'Google login successful',
  accountCreatedSuccess: 'Account created successfully. Use /auth/send-verification-code to receive verification email.',
  clinicStaffCreatedSuccess: 'Clinic staff account created successfully',
  // Email Verification
  emailVerifiedSuccess: 'Email verified successfully. Welcome to Medicare!',
  verificationCodeSentSuccess: 'Verification code sent to your email. Please check your inbox.',
  // Password Reset
  passwordResetCodeSentSuccess: 'Password reset code sent to your email. Please check your inbox.',
  passwordResetSuccess: 'Password reset successfully. You can now login with your new password.',
  passwordUpdateSuccess: 'Password updated successfully',
  // Profile Update
  profileUpdatedWithEmailChange: 'Profile updated successfully. Your new email needs verification. Use /auth/send-verification-code to receive verification email.',
  // Profile Management
  profileFetchSuccess: 'Profile fetched successfully',
  profileCreateSuccess: 'Profile created successfully',
  profileUpdateSuccess: 'Profile updated successfully',
  profileDeleteSuccess: 'Profile deleted successfully',
  // Mail Service
  mailSendSuccess: 'Mail sent successfully',
  registerSuccess: 'User register successfully',
};

const failMessage = {
  index: 'FAILED',
  server: 'Server is not running',
  internalError: 'Internal Server Error',
  invalidData: 'Data is invalid',
  emptyData: 'Data is empty',
  // User Errors
  userNotFound: 'User not found',
  emailAlreadyExists: 'Email already exists',
  userEmailAlreadyExists: 'User with this email already exists',
  userNotDeleted: 'User is not deleted',
  // Authentication Errors
  invalidCredentials: 'Invalid credentials',
  googleAccountNoEmail: 'Google account does not provide an email address',
  // Password Errors
  incorrectPassword: 'Incorrect current password',
  newPasswordSameAsOld: 'New password cannot be the same as the old password',
  passwordResetNotAvailableForOAuth: 'Password reset is not available for OAuth users. Please login with Google',
  oauthUserCannotResetPassword: 'OAuth users cannot reset password. Please login with your OAuth provider',
  // Ban/Status Errors
  userAlreadyBanned: 'User is already banned',
  userNotBanned: 'User is not banned',
  userAccountBanned: 'Your account has been banned. Please contact support',
  userAccountInactive: 'Your account is inactive. Please reactivate your account',
  cannotBanAdmin: 'Cannot ban admin users',
  cannotDeleteSelf: 'Cannot delete your own account',
  cannotBanSelf: 'Cannot ban your own account',
  // Email Verification Errors
  emailAlreadyVerified: 'Email is already verified',
  noVerificationCodeFound: 'No verification code found. Please request a new one',
  invalidVerificationCode: 'Invalid verification code',
  verificationCodeExpired: 'Verification code has expired. Please request a new one',
  noResetCodeFound: 'No reset code found. Please request password reset again',
  invalidResetCode: 'Invalid reset code',
  resetCodeExpired: 'Reset code has expired. Please request password reset again',
  // Role/Permission Errors
  invalidPatientId: 'Provided patientId does not belong to a PATIENT role',
  patientOwnerRequired: 'Clinic staff account must have a patientOwnerId',
  patientOwnerMustBePatient: 'patientOwnerId must reference a user with role PATIENT',
  // Conversation & Message Errors
  conversationNotFound: 'Conversation not found',
  messageNotFound: 'Message not found',
  // Profile Errors
  profileNotFound: 'Profile not found',
  profileAlreadyExists: 'Profile already exists for this user',
  cannotUpdateOtherProfile: 'You can only update your own profile',
};

const MESSAGES = {
  statusCode,
  successMessage,
  failMessage,
};

export { MESSAGES };
