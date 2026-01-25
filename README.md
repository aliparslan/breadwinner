# 🍞 Breadwinner
> Make cents of your spending!

Breadwinner is a personal finance application designed to help users track their spending, manage monthly budgets, and visualize financial habits with ease. It offers a modern, interactive interface for categorizing transactions and gaining insights into spending patterns.

## Features

- **Transaction Tracking**: Log daily expenses and specific income sources.
- **Categorization**: Organize purchases into categories like Food, Transport, Housing, etc.
- **Visual Analytics**: Interactive monthly spending breakdown with bar charts and detailed legends.
- **Filtering**: Filter transactions by category or search by description.
- **Mobile Friendly**: Fully responsive design optimized for both desktop and mobile use.
- **Secure Authentication**: User accounts managed securely via Supabase.
- **AI Insights**: Provides smart summaries and observations about your spending trends.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0 or higher)
- A Supabase account and project URL/Key

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/aliparslan/breadwinner.git
    cd breadwinner
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

3.  Configure Environment:
    Create a `.dev.vars` file in the root directory to store your secrets for local development with Wrangler:
    ```bash
    # .dev.vars
    SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
    SUPABASE_KEY="YOUR_SUPABASE_ANON_KEY"
    GEMINI_API_KEY="YOUR_API_KEY" # If using AI features
    ```

4.  Run Locally:
    Start the local development server using Wrangler:
    ```bash
    npx wrangler pages dev public
    ```
    Open the provided local URL (usually `http://localhost:8788`) in your browser.

## Deployment

This project is built to be deployed on **Cloudflare Pages**.

1.  Connect your repository to Cloudflare Pages.
2.  Set the build output directory to `public`.
3.  Add your production environment variables (SUPABASE_URL, SUPABASE_KEY, etc.) in the Cloudflare Pages dashboard settings.

## License

This project is open source and available under the MIT License.
