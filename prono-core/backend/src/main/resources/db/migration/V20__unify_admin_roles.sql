-- Migrate legacy ADMIN role to PLATFORM_ADMIN (ADMIN enum value removed)
UPDATE users SET role = 'PLATFORM_ADMIN' WHERE role = 'ADMIN';
