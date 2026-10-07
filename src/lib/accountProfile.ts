export type AccountProfile = { firstName: string; lastName: string; username: string; phone: string };

export const emptyAccountProfile: AccountProfile = { firstName: '', lastName: '', username: '', phone: '' };

export const normalizeAccountProfile = (profile: AccountProfile): AccountProfile => ({
  firstName: profile.firstName.trim(), lastName: profile.lastName.trim(),
  username: profile.username.trim().toLowerCase(), phone: profile.phone.trim()
});

export const accountProfileError = (profile: AccountProfile): string | null => {
  const value = normalizeAccountProfile(profile);
  if (!value.firstName || !value.lastName || value.firstName.length > 80 || value.lastName.length > 80)
    return 'Enter your first and last name (up to 80 characters each).';
  if (!/^[a-z0-9_]{3,30}$/.test(value.username)) return 'Username must contain 3–30 letters, numbers or underscores.';
  if (value.phone && !/^\+?[0-9 ()-]{6,32}$/.test(value.phone)) return 'Enter a valid phone number, including the country code.';
  return null;
};
