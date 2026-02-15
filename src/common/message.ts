const statusCode = {
  success: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  userError: 405,
  emailVerificationRequired: 403, // Custom: Account exists but email not verified
  accountIncomplete: 403, // Custom: Account registration incomplete
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
  loginSuccessUnverified: 'Login successful. Please verify your email address to access full features.',
  googleLoginSuccess: 'Google login successful',
  paymentCreateSuccess: 'Payment QR created successfully',
  paymentUpdateSuccess: 'Payment status updated successfully',
  // 2-Step Registration
  accountBasicCreated:
    'Account created successfully. Please complete your profile in Step 2.',
  accountProfileCompleted:
    'Profile created successfully. Please request verification code via POST /mailer/send-verification-code to activate your account.',
  // Clinic Manager
  clinicManagerCreated: 'Clinic manager account created successfully',
  clinicStaffCreatedSuccess:
    'Clinic staff account created successfully with PENDING status. Staff must complete profile before login.',
  clinicDoctorCreatedSuccess:
    'Doctor account created successfully with PENDING status. Doctor must complete profile before login.',
  // Email Verification
  emailVerifiedSuccess:
    'Email verified successfully. Your account is now ACTIVE. Welcome to Medicare!',
  verificationCodeSentSuccess:
    'Verification code sent to your email. Code expires in 10 minutes. Please check your inbox.',
  // Password Management
  passwordResetCodeSentSuccess:
    'Password reset code sent to your email. Code expires in 15 minutes. Please check your inbox.',
  passwordResetSuccess:
    'Password reset successfully. You can now login with your new password.',
  passwordUpdateSuccess: 'Password updated successfully',
  // Profile Update
  profileUpdatedSuccess: 'Profile updated successfully',
  profileUpdatedWithEmailChange:
    'Email updated successfully. Your account status is now PENDING. Please request verification code via POST /mailer/send-verification-code to verify your new email.',
  // Legacy (Deprecated)
  accountCreatedSuccess: 'Account created successfully',
  clinicStaffCreated: 'Clinic staff created successfully',
  // Profile Management
  profileFetchSuccess: 'Profile fetched successfully',
  profileCreateSuccess: 'Profile created successfully',
  profileDeleteSuccess: 'Profile deleted successfully',
  // Appointment Management
  appointmentAcceptedSuccess: 'Appointment accepted successfully',
  appointmentDeclinedSuccess: 'Appointment declined successfully',
  appointmentStatusUpdatedSuccess: 'Appointment status updated successfully',
  appointmentCreatedSuccess: 'Appointment created successfully',
  // Mail Service
  mailSendSuccess: 'Mail sent successfully',
  registerSuccess: 'User register successfully',
  // Cancellation
  registrationCancelled: 'Registration cancelled successfully',
  subscriptionCancelled: 'Subscription cancelled successfully',
  // Subscription
  subscriptionFetchedSuccess: 'Subscription fetched successfully',
  subscriptionHistoryFetchedSuccess: 'Subscription history fetched successfully',
  // Feedback
  feedbackCreatedSuccess: 'Feedback created successfully',
};

const failMessage = {
  index: 'FAILED',
  server: 'Server is not running',
  internalError: 'Internal Server Error',
  invalidData: 'Data is invalid',
  emptyData: 'Data is empty',
  // User Errors
  userNotFound: 'User not found',
  accountNotFound: 'Account not found',
  emailAlreadyExists: 'Email already exists',
  userEmailAlreadyExists: 'User with this email already exists',
  userNotDeleted: 'User is not deleted',
  // Authentication Errors
  invalidCredentials: 'Invalid email or password',
  googleAccountNoEmail: 'Google account does not provide an email address',
  // Account Status Errors
  accountPendingVerification:
    'Email verification required. Please verify your email to activate your account.',
  accountNotActive: 'Account is not active. Please contact support.',
  // Password Errors
  incorrectPassword: 'Incorrect current password',
  newPasswordSameAsOld: 'New password cannot be the same as the old password',
  passwordResetNotAvailableForOAuth:
    'Password reset is not available for OAuth users. Please login with Google',
  oauthUserCannotResetPassword:
    'OAuth users cannot reset password. Please login with your OAuth provider (Google, etc.)',
  // Ban/Status Errors
  userAlreadyBanned: 'User is already banned',
  userNotBanned: 'User is not banned',
  userAccountBanned:
    'Your account has been banned. Please contact support at support@medicare.com',
  userAccountInactive:
    'Your account is suspended. Please contact support to reactivate',
  userAccountDeleted:
    'Your account has been deleted. Please contact support for assistance.',
  userAccountExpired:
    'Your subscription has expired. Please renew your subscription to continue.',
  userAccountRefill:
    'Your account needs a refill. Please refill your subscription to continue.',
  cannotBanAdmin: 'Cannot ban admin users',
  cannotDeleteSelf: 'Cannot delete your own account',
  cannotBanSelf: 'Cannot ban your own account',
  // Email Verification Errors
  emailAlreadyVerified: 'Email is already verified',
  emailNotVerified: 'Email is not verified. Please verify your email first.',
  noVerificationCodeFound:
    'No verification code found or code has already been used. Please request a new one.',
  invalidVerificationCode:
    'Invalid verification code. Please check and try again.',
  verificationCodeExpired:
    'Verification code has expired. Please request a new one via POST /mailer/send-verification-code',
  verificationCodeAlreadyUsed:
    'Verification code has already been used. Please request a new one.',
  noResetCodeFound:
    'No reset code found or code has already been used. Please request password reset again.',
  invalidResetCode: 'Invalid reset code. Please check and try again.',
  resetCodeExpired:
    'Reset code has expired (15 minutes). Please request password reset again.',
  resetCodeAlreadyUsed:
    'Reset code has already been used. Please request a new one.',
  // Role/Permission Errors
  invalidPatientId: 'Provided patientId does not belong to a PATIENT role',
  onlyPatientCanChangeEmail:
    'Only PATIENT accounts can change their email address. Other roles must contact administrator.',
  patientOwnerRequired: 'Clinic staff account must have a patientOwnerId',
  patientOwnerMustBePatient:
    'patientOwnerId must reference a user with role PATIENT',
  onlyPatientCanUpgradeToManager:
    'Only PATIENT accounts can upgrade to CLINIC_MANAGER',
  onlyManagerCanAddStaff:
    'Only CLINIC_MANAGER can add staff and doctor accounts',
  insufficientPermissions: 'You do not have permission to perform this action',
  // 2-Step Registration Errors
  accountNotIncomplete: 'Account is not in PENDING state',
  profileCreationFailed:
    'Failed to create profile. Account has been deleted. Please register again.',
  // Clinic Admin Registration Flow
  clinicAdminRegistrationSuccess:
    'Clinic admin account created successfully. Please complete your payment configuration.',
  emailUsageLimitExceeded:
    'Email can only be used once as CLINIC_ADMIN and once as CLINIC_MANAGER. This email has reached its maximum usage limit.',
  registrationStatusNotFound:
    'No registration found for this email. You can start a new registration.',
  registrationStatusInProgress:
    'Registration is in progress. Please complete the required steps.',
  // Conversation & Message Errors
  conversationNotFound: 'Conversation not found',
  messageNotFound: 'Message not found',
  // Appointment Errors
  appointmentNotFound: 'Appointment not found',
  appointmentTimeConflict:
    'Appointment time is already booked. Please choose a different time slot.',
  appointmentCannotBeAccepted:
    'Only appointments with PENDING status can be accepted',
  appointmentCannotBeDeclined:
    'Only appointments with PENDING status can be declined',
  appointmentNotAssignedToDoctor: 'This appointment is not assigned to you',
  invalidStatusTransition:
    'Invalid status transition. Please check the current appointment status and target status.',
  reasonRequiredForStatus:
    'Reason is required when changing status to CANCELLED, PAYMENT_FAILED, PAYMENT_CANCELLED, or ABSENT',
  // Profile Errors
  profileNotFound: 'Profile not found',
  profileAlreadyExists: 'Profile already exists for this user',
  cannotUpdateOtherProfile: 'You can only update your own profile',
  generalAccountNotFound: 'General account profile not found',
  // Cancellation Errors
  pendingApprovalBlocked:
    "Cannot cancel registration while documents are under review. Please wait for the Admin's decision.",
  successTransactionExists:
    'Cannot cancel registration after successful payment',
  invalidStatus: 'Cannot cancel registration with current status',
  subscriptionNotActive: 'Only active subscriptions can be cancelled',
  // Subscription Errors
  subscriptionNotFound: 'No active subscription found for your clinic',
  subscriptionHistoryNotFound: 'No subscription history found',
  // Feedback Errors
  feedbackToxicContent: 'Feedback contains inappropriate content',
  feedbackNotFound: 'Feedback not found',
};

const MESSAGES = {
  statusCode,
  successMessage,
  failMessage,
};

export { MESSAGES };
