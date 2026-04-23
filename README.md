# Capstone Angular 2026

This repository is organized as a small npm workspace with two apps:

- `frontend/` contains the Angular client.
- `backend/` contains the Express API.

The root `package.json` is the workspace manager, so you can run the main commands from the repo root instead of changing directories.

## Project Structure

```text
capstone-angular-2026/
├── backend/     # Express API
├── frontend/    # Angular app
├── package.json # workspace scripts
└── README.md
```

## Install Dependencies

From the repository root:

```bash
npm install
```

That installs dependencies for both workspace packages.

## Common Commands

Run the Angular frontend:

```bash
npm start
```

Run the Express backend:

```bash
npm run start:backend
```

Run the backend in development mode:

```bash
npm run dev:backend
```

Build the frontend:

```bash
npm run build
```

Run frontend tests:

```bash
npm test
```

## Notes

- The Angular CLI config lives in `frontend/angular.json`.
- The backend entry point is `backend/index.js`.
- Git ignore rules are centralized in the repo-level `.gitignore` so the project is easier to maintain.
