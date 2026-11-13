# KWAN Education Platform

A full-stack education platform for learners, tutors, and administrators in Uganda. KWAN combines a public-facing school website with role-based learning environments for primary, lower secondary, and upper secondary learners.

The app is built with React + Vite on the frontend and an Express API with a local JSON-backed database for the backend. It supports user registration, course enrollment, resource purchases, tutor marking, admin content management, and division-specific learning experiences.

## Highlights

- Public website with homepage, about page, blog, resources, and Get Started flow
- Multi-role authentication for students, tutors, and admins
- Division-specific learner environments:
  - Primary
  - Lower Secondary
  - Upper Secondary
- Course catalog with free and paid access
- Tutor workspace for managing courses, submissions, and feedback
- Admin dashboard for platform oversight and CMS-style website editing
- Blog and resource marketplace using seeded demo content
- Local persistence via JSON database in the `data/` folder

## Tech Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend: Express + TypeScript
- Data layer: local JSON file storage (`data/kwan-db.json`)
- Asset handling: static asset serving for course images and uploaded media

## Project Structure

```text
.
├── data/                     # Persistent JSON database and uploaded media
├── public/                   # Static public assets
├── server/                   # Server utilities and seed data
│   ├── db.ts                 # JSON database access and seed logic
│   ├── seedData.ts           # Demo platform data
│   └── ...
├── src/
│   ├── components/           # UI for public site, learner spaces, tutor tools, admin tools
│   ├── lib/                 # API helpers
│   ├── types/               # Platform TypeScript models
│   ├── App.tsx              # Route and role-based app shell
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── index.html               # Vite entry HTML
├── package.json             # Scripts and dependencies
├── server.ts                # Express server entry point
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── README.md                # Project documentation
```

## Prerequisites

Before you begin, make sure you have:

- Node.js 18+ or newer
- npm 9+

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/kwan-ayen/Kwanedu.git
cd Kwanedu
npm install --legacy-peer-deps
```

Why `--legacy-peer-deps`?

This project currently includes dependency versions that can trigger peer conflict resolution issues during install. The compatibility flag is the safest way to get the app running in this environment without altering the project’s intended dependency set.

## Running the App

Start the development server:

```bash
npm run dev
```

The app will run on:

```text
http://localhost:3000
```

## Available Scripts

```bash
npm run dev      # Start the Express + Vite development server
npm run build    # Build production assets
npm run preview  # Preview the production build
npm run lint     # Type-check the project with TypeScript
npm run clean    # Remove generated build artifacts
```

## Authentication and Roles

The app supports three role types:

### Student
- Learner portal for a selected division and class
- Access to division-specific course content
- Progress tracking, badges, and completion history
- Course purchasing and resource access

### Tutor
- Course assignment and content oversight
- Student submission review and marking
- Feedback delivery and performance tracking

### Admin
- Full platform dashboard
- Course publishing and management
- CMS-style page editing and media management
- Website overview and section configuration

## Data and Persistence

The platform stores its state in a local JSON database file:

```text
data/kwan-db.json
```

On first run, the app seeds default demo data if no database file exists. Any changes made through the interface are persisted to this file automatically.

Uploaded media and CMS assets are stored under:

```text
data/uploads/
```

## Local Demo Notes

The seeded data includes example users, courses, resources, forum threads, and CMS content so the app can be explored immediately without external services.

Common demo paths:

- Public home page: `/?page=home&view=public`
- Registration: via the public “Get Started” flow
- Login: via the public login page or app auth forms
- Admin dashboard: log in as an admin user seeded in the demo data

## Production Build

To create a production bundle:

```bash
npm run build
```

Then you can serve the generated output with a static server or deploy using your preferred hosting platform. The project is structured so the UI and API can be hosted together through a Node-based deployment flow.

## Common Troubleshooting

### `tsx: not found`

This happens when dependencies were not installed. Run:

```bash
npm install --legacy-peer-deps
```

### Peer dependency conflict during install

Use:

```bash
npm install --legacy-peer-deps
```

### Server does not start

Make sure you are in the project root and that all dependencies were installed successfully.

## License

This repository does not currently declare a license file. If you plan to distribute or reuse this project commercially or publicly, add a license before production use.

## Contributing

Contributions are welcome. For larger changes, please open an issue or pull request and describe the feature, bug fix, or enhancement clearly.

## Summary

KWAN Education Platform is a role-based education system designed to support digital learning for Ugandan schools. It goes beyond a simple landing page by delivering a working classroom and administration experience with seeded data, content management, and learner lifecycle flows.
