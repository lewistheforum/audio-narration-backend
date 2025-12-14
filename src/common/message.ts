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
  userFetchSuccess: 'Users fetched successfully',
  userCreateSuccess: 'User created successfully',
  userUpdateSuccess: 'User updated successfully',
  userDeleteSuccess: 'User deleted successfully',
  mailSendSuccess: 'Mail sent successfully',
  loginSuccess: 'User logged in successfully',
  registerSuccess: 'User register successfully',
};

const failMessage = {
  index: 'FAILED',
  server: 'Server is not running',
  internalError: 'Internal Server Error',
  invalidData: 'Data is invalid',
  emptyData: 'Data is empty',
  userNotFound: 'User not found',
  emailAlreadyExists: 'Email already exists',
  userEmailAlreadyExists: 'User with this email already exists',
  incorrectPassword: 'Incorrect current password.',
  newPasswordSameAsOld: 'New password cannot be the same as the old password.',
  conversationNotFound: 'Conversation not found',
  messageNotFound: 'Message not found',
};

const MESSAGES = {
  statusCode,
  successMessage,
  failMessage,
};

export { MESSAGES };
