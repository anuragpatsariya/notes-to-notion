# Image to Text to Notion

A React application that uploads images, extracts text and content using OpenAI's GPT-4o API, and creates Notion pages with the extracted content.

## Features

- 🖼️ **Image Upload**: Drag and drop or click to upload images (JPEG, PNG, GIF, BMP, WebP)
- 🤖 **AI Text Extraction**: Uses OpenAI's GPT-4o to extract text, charts, diagrams, and other content from images
- 📝 **Notion Integration**: Automatically creates new pages in your Notion database with the extracted content
- 🎨 **Modern UI**: Beautiful, responsive interface with real-time processing feedback

## Prerequisites

Before running this application, you'll need:

1. **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Notion API Key**: Create an integration at [Notion Integrations](https://www.notion.so/my-integrations)
3. **Notion Database ID**: The ID of the database where pages will be created

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd image-to-text-to-notion
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Notion API Configuration
NOTION_API_KEY=your_notion_api_key_here

# Notion Database ID
NOTION_DATABASE_ID=your_notion_database_id_here

# Server Configuration
PORT=3001
```

### 3. Notion Setup

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the "Internal Integration Token" (this is your `NOTION_API_KEY`)
4. Create a database in Notion where you want pages to be created
5. Share the database with your integration
6. Copy the database ID from the URL (the part after the last `/`)

### 4. Running the Application

#### Development Mode (Frontend + Backend)
```bash
npm run dev
```

This will start both the React frontend (port 3000) and Express backend (port 3001).

#### Production Mode
```bash
# Build the React app
npm run build

# Start only the backend server
npm run server
```

## How It Works

1. **Image Upload**: Users can drag and drop or click to upload an image
2. **Text Extraction**: The image is sent to OpenAI's GPT-4o API for analysis
3. **Content Processing**: The AI extracts text, charts, diagrams, and other readable content
4. **Notion Creation**: A new page is created in your Notion database with the extracted content
5. **Result Display**: Users can view the extracted content and link to the created Notion page

## API Endpoints

- `POST /api/extract-text`: Extracts text from an image using OpenAI
- `POST /api/create-notion-page`: Creates a new page in Notion
- `GET /api/health`: Health check endpoint

## Technologies Used

- **Frontend**: React, TypeScript, React Dropzone, Axios
- **Backend**: Express.js, Node.js
- **APIs**: OpenAI GPT-4o, Notion API
- **Styling**: CSS3 with modern design patterns

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**: Make sure your `.env` file has the correct `OPENAI_API_KEY`
2. **"Notion API key or database ID not configured"**: Verify your Notion credentials in the `.env` file
3. **"Failed to create Notion page"**: Ensure your Notion integration has access to the database
4. **CORS errors**: The backend includes CORS configuration, but make sure both servers are running

### Getting Notion Database ID

1. Open your Notion database in the browser
2. Look at the URL: `https://notion.so/workspace/database-id?v=...`
3. Copy the `database-id` part (it's a long string of characters)

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).
