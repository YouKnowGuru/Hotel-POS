# Restaurant POS System (Frontend Mock)

A modern, role-based restaurant POS system built with React and Tailwind CSS. This project uses local mock data and is suitable for demos, prototyping, and UI/UX development.

## Features
- Role-based login (Admin, Franchise, Sub-Franchise, Manager, Waiter)
- Dashboard & analytics
- Menu management (CRUD)
- Dine-in and takeaway order management
- Inventory management
- Billing and receipt printing
- Kitchen Display System (KDS)
- QR code ordering and management
- Responsive, modern UI with Tailwind CSS

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/restaurant-pos-mock.git
   cd restaurant-pos-mock
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Login Credentials
See the login page for demo credentials for each role (e.g., `admin`/`admin`, `waiter1`/`pass`, etc).

## Project Structure
- `src/components/` — All React components
- `src/mock/` — Mock API and user data
- `src/index.js` — App entry point
- `src/index.css` — Global styles (Tailwind + Inter font)

## Customization
- To use a real backend, replace the mock API functions in `src/mock/` with real API calls.
- Tailwind config can be customized as needed.

## License
MIT 