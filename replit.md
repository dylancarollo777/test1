# 1ISTEN

## Overview

1ISTEN is a podcast production platform designed for academic institutions. It enables colleges and universities to manage podcast projects from submission to publication. The system supports different user roles (clients, producers, admins) and provides a complete workflow for podcast creation, review, and distribution.

The application features a React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence and Google Cloud Storage for file management. It includes real-time project tracking, messaging systems, audio file management, and role-based access control.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**Brand Name Update (January 2025)**: Changed all CollegeCast references to 1ISTEN throughout the application including:
- Landing page branding and content
- Navigation components 
- HTML page title
- Contact information (email changed to hello@1listen.com)
- Footer copyright (updated to 2025)
- Documentation updates

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: TanStack Query for server state and React hooks for local state
- **Routing**: Wouter for client-side routing
- **File Uploads**: Uppy dashboard with direct-to-cloud storage capabilities

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with role-based route protection
- **Middleware**: Custom authentication middleware, request logging, and error handling
- **File Handling**: Object storage service with ACL-based access control

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless with connection pooling
- **ORM**: Drizzle ORM with schema-first approach
- **Session Management**: PostgreSQL-backed sessions for authentication
- **File Storage**: Google Cloud Storage with custom ACL implementation
- **Schema**: Comprehensive data model covering users, projects, podcasts, messages, and files

### Authentication and Authorization
- **Provider**: Replit OIDC authentication with Passport.js integration
- **Session Strategy**: Server-side sessions with PostgreSQL storage
- **Access Control**: Role-based permissions (client, producer, admin)
- **File Security**: Custom object ACL system for fine-grained file access control

### Key Data Models
- **Users**: Support for multiple roles with institutional affiliations
- **Projects**: Complete lifecycle from submission to publication with status tracking
- **Podcasts**: Audio content with metadata, play counts, and publication status
- **Messages**: Project communication system with internal/external visibility
- **Files**: Project attachments with secure access controls

### Project Workflow
The system implements a structured podcast production workflow:
1. **Submission**: Clients submit project requests with descriptions and requirements
2. **Planning**: Producers review and plan project execution
3. **Production**: Active podcast creation with file uploads and messaging
4. **Review**: Quality assurance and approval process
5. **Publication**: Final podcast distribution and public availability

## External Dependencies

### Cloud Services
- **Google Cloud Storage**: File storage and management with ACL support
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling

### Authentication
- **Replit OIDC**: Primary authentication provider
- **Passport.js**: Authentication middleware and strategy management

### UI and Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build tool and development server
- **Drizzle Kit**: Database schema management and migrations
- **TypeScript**: Type safety across the entire application

### File Upload
- **Uppy**: File upload handling with dashboard UI
- **AWS S3 Plugin**: Direct-to-cloud upload capabilities

### Additional Libraries
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling with validation
- **Zod**: Schema validation and type inference
- **Wouter**: Lightweight routing solution