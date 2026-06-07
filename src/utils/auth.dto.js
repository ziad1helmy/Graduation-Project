export const buildValidateTokenResponse = (reqUser) => {
  if (!reqUser) return null;

  return {
    is_valid: true,
    role: reqUser.role,
    userId: reqUser.userId,
    user_id: reqUser.userId,
    user_role: reqUser.role,
  };
};
