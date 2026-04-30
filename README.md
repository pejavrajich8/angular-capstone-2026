# Capstone Angular 2026

This repository is organized as a small npm workspace with two apps:

- `frontend/` contains the Ionic/Angular client.
- `backend/` contains the Express API.

The root `package.json` is the workspace manager, so you can run the main commands from the repo root instead of changing directories.

## Tech Stack

- **Frontend** — [Ionic 8](https://ionicframework.com/) + [Angular 21](https://angular.dev/) (standalone components)
- **Backend** — Express API

## Project Structure

```text
capstone-angular-2026/
├── backend/          # Express API
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── tabs/     # Tab shell + routing
│   │       ├── tab1/     # Tab 1 page
│   │       ├── tab2/     # Tab 2 page
│   │       └── tab3/     # Tab 3 page
│   ├── angular.json
│   └── ionic.config.json
├── package.json      # workspace scripts
└── README.md
```

## Install Dependencies

From the repository root:

```bash
npm install
```

That installs dependencies for both workspace packages.

## Common Commands

Run the Ionic frontend (via Angular CLI):

```bash
npm start
```

Or from the `frontend/` directory using the Ionic CLI:

```bash
ionic serve
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

## Adding Pages

Each page is a standalone Angular component using Ionic components. To add a new page, create a folder under `src/app/` with a `.page.ts` and `.page.html`, then register it in the relevant routes file.

## Notes

- Ionic components are imported individually from `@ionic/angular/standalone` — no module needed.
- `zone.js` is loaded via the `polyfills` option in `frontend/angular.json`.
- The Angular CLI config lives in `frontend/angular.json`.
- The backend entry point is `backend/index.js`.
- Git ignore rules are centralized in the repo-level `.gitignore`.
