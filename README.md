# eWizard Requirement Prioritizer

A web application for prioritizing and managing requirements using customizable criteria and analytics.

## Features

- Import requirements from Excel files
- Score requirements based on custom criteria
- Rank requirements based on scores
- Visual analytics and insights
- Interactive charts and graphs

## Tech Stack

- Frontend: React with TypeScript
- UI Framework: Material-UI
- Charts: Chart.js with react-chartjs-2
- Backend: Node.js with Express
- File Processing: XLSX for Excel handling
- Containerization: Docker

## Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd requirement-prioritizer
```

2. Install dependencies:
```bash
npm install
```

3. Start development servers:
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd server && node index.js
```

## Production Deployment

### Using Docker (Recommended)

1. Build and start the container:
```bash
npm run docker:build
npm run docker:start
```

2. Stop the container:
```bash
npm run docker:stop
```

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The application will be available at `http://localhost:3001`.

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment ('development' or 'production')

## Project Structure

```
requirement-prioritizer/
├── src/                  # Frontend source code
│   ├── components/       # React components
│   └── ...
├── server/              # Backend source code
│   └── index.js         # Express server
├── public/             # Static assets
├── dist/               # Built frontend (after npm run build)
└── uploads/            # Temporary file uploads
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
