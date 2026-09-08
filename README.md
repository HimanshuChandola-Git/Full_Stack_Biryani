# Full Stack Biryani

Full Stack Biryani is a modern web application built to provide a simple and convenient way to explore food online.

The project is developed using Next.js, React, TypeScript, Tailwind CSS, and Supabase. The main focus is on creating a clean, responsive interface while also implementing a proper full-stack structure that can be expanded with more features in the future.

## Features

* Browse and explore available food items
* Responsive interface for desktop and mobile devices
* Fast page navigation using Next.js
* Modern and reusable UI components
* Supabase integration for backend and database functionality
* Clean and organized project structure
* Data visualization support using Recharts
* Type-safe development using TypeScript

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide React

### Backend and Database

* Supabase

### Other Technologies

* Recharts
* PostCSS
* pnpm

## Project Structure

```text
Full_Stack_Biryani/
│
├── app/                 # Application pages and layouts
├── components/          # Reusable components
│   └── ui/              # UI components
├── lib/                 # Helper functions and utilities
├── public/              # Static files and assets
├── team/                # Team-related files
│
├── package.json         # Project dependencies and scripts
├── next.config.mjs      # Next.js configuration
├── tsconfig.json        # TypeScript configuration
├── postcss.config.mjs   # PostCSS configuration
└── README.md            # Project documentation
```

## Getting Started

To run the project on your local machine, first clone the repository:

```bash
git clone https://github.com/HimanshuChandola-Git/Full_Stack_Biryani.git
```

Move into the project directory:

```bash
cd Full_Stack_Biryani
```

Install the required dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Once the server starts, open the following address in your browser:

```text
http://localhost:3000
```

## Environment Variables

If you are using the Supabase functionality, create a `.env.local` file in the root directory and add the required Supabase credentials.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not upload private keys, passwords, or other sensitive credentials to GitHub.

## Available Scripts

### Development

```bash
pnpm dev
```

Starts the development server.

### Build

```bash
pnpm build
```

Creates an optimized production build.

### Production

```bash
pnpm start
```

Starts the application using the production build.

## Future Improvements

The project can be extended with features such as:

* User authentication and profiles
* Shopping cart and order management
* Online payment integration
* Order tracking
* Food ratings and reviews
* Search and filtering
* Order notifications
* Admin dashboard
* Improved mobile experience

## Contributing

Contributions and suggestions are welcome.

If you find a bug or have an idea for improving the project, you can open an issue or submit a pull request.

## Team

This project is developed and maintained by the Full Stack Biryani team.

---

If you like the project, consider giving the repository a star.
