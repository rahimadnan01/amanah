# Admin Panel - Security Foundation

This is the security foundation for a social media platform's internal administrative backend. It implements admin authentication with mandatory MFA, role-based access control, session management, and audit logging.

## Features

- **Multi-Factor Authentication (MFA)**: Mandatory TOTP-based MFA for all admin accounts
- **Role-Based Access Control (RBAC)**: 5 predefined roles with explicit permission strings
- **Session Management**: Session expiry (30 min inactivity, 8 hour max), session revocation
- **Audit Logging**: Append-only audit trail for all sensitive actions
- **Secure Authentication**: 2-step login flow with MFA enforcement
- **Account Lockout**: Rate limiting after 5 failed login attempts

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Postgres (via `@neondatabase/serverless`, works with Neon, Supabase, or any Postgres connection string)
- **Authentication**:
  - `bcryptjs` - Password hashing
  - `jose` - JWT token creation/verification
  - `speakeasy` - TOTP MFA
  - `qrcode` - QR code generation for MFA setup
  - `uuid` - Unique ID generation

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
Copy `.env.example` to `.env.local` and configure:
```env
JWT_SECRET=your-secret-key-here
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

3. **Create the database tables and seed the super admin account**:
```bash
npm run db:setup
```

4. **Run the development server**:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Default Admin Account

The system is seeded with a super admin account:

- **Email**: `superadmin@platform.com`
- **Password**: `Admin@123456`

**Important**: Change this password immediately after first login.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # Authentication API routes
│   │   │   ├── login/         # 2-step login (credentials + MFA)
│   │   │   ├── logout/        # Session revocation
│   │   │   ├── me/            # Current admin info
│   │   │   ├── mfa/setup/     # MFA setup (GET/POST)
│   │   │   └── sessions/      # Session management (GET/DELETE)
│   │   └── admin/             # Admin management API routes
│   │       ├── users/         # Admin CRUD (GET/POST/PATCH)
│   │       └── audit-logs/    # Audit log viewer (GET)
│   ├── dashboard/             # Protected dashboard pages
│   │   ├── layout.tsx         # Dashboard layout with sidebar
│   │   ├── page.tsx           # Dashboard home
│   │   ├── admin-users/       # Admin management page
│   │   ├── sessions/          # Session management page
│   │   ├── mfa-setup/         # MFA setup wizard
│   │   └── audit-logs/        # Audit logs viewer
│   ├── login/                 # Login page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Redirects to dashboard
│   └── globals.css            # Global styles
├── lib/
│   ├── db.ts                  # JSON database layer
│   ├── auth.ts                # Auth utilities (bcrypt, JWT, TOTP)
│   ├── audit.ts               # Audit logging helper
│   └── middleware.ts          # API middleware (auth, permissions)
└── middleware.ts             # Next.js route middleware
data/
└── db.json                    # JSON database file (auto-created)
```

## Roles and Permissions

| Role | Permissions |
|------|-------------|
| `super_admin` | All permissions |
| `moderator` | `content.view`, `content.edit`, `content.delete`, `users.view`, `users.edit`, `users.delete`, `reports.view`, `reports.resolve` |
| `support_agent` | `users.view`, `users.edit`, `sessions.view`, `sessions.revoke` |
| `operations_admin` | `settings.view`, `settings.edit`, `media.view`, `media.upload`, `media.delete` |
| `analyst` | `audit.view`, `analytics.view` |

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email/password (returns MFA requirement if enabled)
- `POST /api/auth/login` - Login with email/password/MFA code
- `POST /api/auth/logout` - Revoke current session
- `GET /api/auth/me` - Get current admin info and permissions
- `GET /api/auth/mfa/setup` - Generate MFA secret and QR code
- `POST /api/auth/mfa/setup` - Verify MFA code and enable MFA
- `GET /api/auth/sessions` - List sessions (own or all for super_admin)
- `DELETE /api/auth/sessions` - Revoke session(s)

### Admin Management (requires `admins.view` / `admins.create` / `admins.edit`)

- `GET /api/admin/users` - List all admin users
- `POST /api/admin/users` - Create new admin user
- `PATCH /api/admin/users` - Update admin user (role, status)

### Audit Logs (requires `audit.view`)

- `GET /api/admin/audit-logs` - List audit logs with filtering and pagination

## Security Features

### Session Management
- **Inactivity Expiry**: Sessions expire after 30 minutes of inactivity
- **Max Lifetime**: Sessions expire after 8 hours regardless of activity
- **Revocation**: Sessions can be revoked individually or all at once
- **Instant Invalidation**: Disabling an account immediately revokes all sessions

### MFA Enforcement
- **Mandatory**: All admin accounts must have MFA enabled
- **2-Step Login**: Requires both credentials and MFA code
- **TOTP Compatible**: Works with Google Authenticator, Authy, etc.

### Rate Limiting
- **Login Attempts**: Account locked after 5 failed attempts
- **MFA Attempts**: Rate limited to prevent brute force

### Audit Logging
- **Append-Only**: Audit logs cannot be modified or deleted
- **Sensitive Data Masking**: Passwords and secrets are redacted
- **Comprehensive**: Logs include IP address, session ID, request ID
- **Action Tracking**: All sensitive actions are logged with outcome

### Cookie Security
- **HttpOnly**: Cookies not accessible via JavaScript
- **SameSite=Strict**: Prevents CSRF attacks
- **Secure**: HTTPS-only in production
- **Signed**: Cookies are cryptographically signed

## Development Notes

### TypeScript Errors
You may see TypeScript errors about missing module declarations. These will resolve after running `npm install`.

### Database
The JSON database is auto-created on first run. It's stored in `/data/db.json` and includes:
- `adminUsers` - Admin user accounts
- `adminSessions` - Active and revoked sessions
- `auditLogs` - Audit trail
- `rolePermissions` - Role-to-permission mapping

### Environment Variables
- `JWT_SECRET`: Required for JWT token signing. Use a strong, random secret in production.

## Testing

Run tests with:
```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Ensure HTTPS is enabled
4. Review and update CSP headers in `next.config.js`

## License

Internal use only.
# amanah
