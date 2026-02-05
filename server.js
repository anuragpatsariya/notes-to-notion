const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Function to extract chart images from the original image
async function extractChartImages(base64Image, filename) {
  try {
    // Use OpenAI to identify chart regions and get coordinates
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and identify any charts, graphs, or diagrams. For each chart found, provide the following information in JSON format:
                {
                  "charts": [
                    {
                      "type": "chart type (bar, line, pie, etc.)",
                      "description": "brief description",
                      "coordinates": {
                        "x1": "left coordinate (0-100%)",
                        "y1": "top coordinate (0-100%)", 
                        "x2": "right coordinate (0-100%)",
                        "y2": "bottom coordinate (0-100%)"
                      }
                    }
                  ]
                }
                
                Only return the JSON, no other text. If no charts are found, return {"charts": []}.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let content = response.data.choices[0].message.content;
    
    // Clean up the response - remove markdown formatting if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    content = content.trim();
    
    try {
      const chartData = JSON.parse(content);
      return chartData.charts || [];
    } catch (parseError) {
      console.error('Error parsing chart data JSON:', parseError);
      console.log('Raw content:', content);
      return [];
    }
  } catch (error) {
    console.error('Error extracting chart data:', error);
    return [];
  }
}

// Function to get emoji for chart type
function getChartEmoji(chartType) {
  const emojiMap = {
    'bar': '📊',
    'line': '📈',
    'pie': '🥧',
    'scatter': '🔍',
    'histogram': '📊',
    'area': '📊',
    'bubble': '🫧',
    'radar': '🎯',
    'doughnut': '🍩',
    'funnel': '🫙',
    'waterfall': '🌊',
    'heatmap': '🔥',
    'treemap': '🌳',
    'sankey': '🌊',
    'gantt': '📅',
    'candlestick': '🕯️',
    'box': '📦',
    'violin': '🎻',
    'default': '📊'
  };
  
  const type = chartType.toLowerCase();
  return emojiMap[type] || emojiMap.default;
}

// Function to upload image to Notion
async function uploadImageToNotion(imageBuffer, filename) {
  try {
    // First, upload the file to Notion
    const uploadResponse = await axios.post(
      'https://api.notion.com/v1/files',
      {
        parent: {
          type: 'page_id',
          page_id: 'temp' // This will be replaced with actual page ID
        },
        properties: {
          title: [
            {
              text: {
                content: filename
              }
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    return uploadResponse.data.url;
  } catch (error) {
    console.error('Error uploading image to Notion:', error);
    return null;
  }
}

// Function to process content for Notion with emojis and charts
function processContentForNotion(content) {
  const blocks = [];
  
  // Split content into paragraphs
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  
  paragraphs.forEach(paragraph => {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) return;
    
    // Check if this paragraph describes a chart
    const chartKeywords = ['chart', 'graph', 'diagram', 'plot', 'visualization', 'bar chart', 'line chart', 'pie chart', 'scatter plot', 'histogram', 'pie chart', 'area chart'];
    const isChartDescription = chartKeywords.some(keyword => 
      trimmedParagraph.toLowerCase().includes(keyword)
    );
    
    // Check for emoji patterns and replace with actual emojis
    let processedText = trimmedParagraph;
    
    // Common emoji replacements
    const emojiReplacements = {
      'sad face': '😢',
      'happy face': '😊',
      'smiling face': '😊',
      'frowning face': '😞',
      'crying face': '😢',
      'laughing face': '😂',
      'heart': '❤️',
      'star': '⭐',
      'check mark': '✅',
      'x mark': '❌',
      'warning': '⚠️',
      'info': 'ℹ️',
      'question mark': '❓',
      'exclamation mark': '❗',
      'thumbs up': '👍',
      'thumbs down': '👎',
      'fire': '🔥',
      'rocket': '🚀',
      'money': '💰',
      'chart': '📊',
      'graph': '📈',
      'diagram': '📋'
    };
    
    Object.entries(emojiReplacements).forEach(([text, emoji]) => {
      const regex = new RegExp(text, 'gi');
      processedText = processedText.replace(regex, emoji);
    });
    
    if (isChartDescription) {
      // Add chart description as a callout block with chart emoji
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `📊 ${processedText}`
              }
            }
          ],
          icon: {
            type: 'emoji',
            emoji: '📊'
          },
          color: 'blue_background'
        }
      });
    } else {
      // Regular paragraph with emoji support
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: processedText
              }
            }
          ]
        }
      });
    }
  });
  
  return blocks;
}

// OpenAI API endpoint to extract text from image
app.post('/api/extract-text', async (req, res) => {
  try {
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this image and extract all text, charts, diagrams, and any other readable content. 

IMPORTANT INSTRUCTIONS:
1. For emojis: If you see any emoji (like 😢, 😊, 📊, etc.), include the actual emoji character in your response, not a description.
2. For charts and diagrams: Provide a detailed description of the chart type, data, and key insights. Identify the chart type (bar, line, pie, scatter, etc.) and describe the data being visualized.
3. For text: Extract all readable text exactly as it appears.
4. Format the response in a clear, structured way.

Please provide a comprehensive analysis including any text, numbers, charts, diagrams, emojis, or other visual elements.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const extractedText = response.data.choices[0].message.content;
    res.json({ text: extractedText });

  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to extract text from image',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Notion API endpoint to create a new page
app.post('/api/create-notion-page', async (req, res) => {
  try {
    const { title, content, originalImage } = req.body;
    
    // Extract chart information from the original image
    let chartImages = [];
    if (originalImage) {
      chartImages = await extractChartImages(originalImage, title);
    }
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      return res.status(500).json({ error: 'Notion API key or database ID not configured' });
    }

    // Format database ID with hyphens if needed
    let databaseId = process.env.NOTION_DATABASE_ID;
    if (databaseId.length === 32) {
      // Add hyphens to format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      databaseId = databaseId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }

    // Process content to handle emojis and charts better
    const processedContent = processContentForNotion(content);
    
    // Note: Notion external URLs have a 2000 character limit, so we can't use base64 data
    // The original image will be described in the text content instead
    
    // Add chart images if found
    if (chartImages.length > 0) {
      // Add a heading for charts
      processedContent.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: '📊 Charts & Diagrams'
              }
            }
          ]
        }
      });
      
      // Add each chart with its description
      for (const chart of chartImages) {
        // Add chart description
        processedContent.push({
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `${getChartEmoji(chart.type)} ${chart.type.toUpperCase()} Chart: ${chart.description}`
                }
              }
            ],
            icon: {
              type: 'emoji',
              emoji: getChartEmoji(chart.type)
            },
            color: 'blue_background'
          }
        });
        
        // Chart images are described in the text content since Notion has URL length limits
      }
    }
    
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: {
          database_id: databaseId
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          }
        },
        children: processedContent
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const pageId = response.data.id;
    const pageUrl = `https://notion.so/${pageId.replace(/-/g, '')}`;
    
    res.json({ pageUrl });

  } catch (error) {
    console.error('Notion API Error:', error.response?.data || error.message);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create Notion page';
    if (error.response?.status === 404) {
      errorMessage = 'Database not found. Please check your database ID and ensure the database is shared with your integration.';
    } else if (error.response?.status === 413) {
      errorMessage = 'Content too large. Try with a smaller image.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid Notion API key. Please check your integration token.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.response?.data?.message || error.message
    });
  }
});

// Extract figures from handwritten notes using Python script
app.post('/api/extract-figures', async (req, res) => {
  try {
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Create temp_image_storage directory if it doesn't exist
    const outputFolder = path.join(__dirname, 'temp_image_storage');
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Save the uploaded image temporarily
    const baseFilename = filename ? filename.replace(/\.[^/.]+$/, '') : 'uploaded_note';
    const tempImagePath = path.join(outputFolder, `${baseFilename}_input.jpg`);
    
    // Decode base64 and save
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tempImagePath, imageBuffer);

    // Call Python script to extract figures
    // Try OpenAI-based extractor first (simpler, no detectron2 needed)
    const pythonScript = fs.existsSync(path.join(__dirname, 'extract-images-openai.py'))
      ? 'extract-images-openai.py'
      : 'find-image.py';
    
    const pythonProcess = spawn('python3', [
      path.join(__dirname, pythonScript),
      tempImagePath,
      outputFolder
    ]);

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', pythonError);
        return res.status(500).json({ 
          error: 'Failed to extract figures from image',
          details: pythonError || 'Python script execution failed'
        });
      }

      try {
        const result = JSON.parse(pythonOutput);
        
        if (!result.success) {
          return res.status(500).json({ 
            error: 'Failed to extract figures',
            details: result.error
          });
        }

        // Convert extracted images to base64 for frontend display
        const extractedImagesBase64 = result.extracted_images.map(imgPath => {
          const imgBuffer = fs.readFileSync(imgPath);
          return {
            path: imgPath,
            base64: `data:image/jpeg;base64,${imgBuffer.toString('base64')}`,
            filename: path.basename(imgPath)
          };
        });

        res.json({
          success: true,
          extracted_count: result.extracted_count,
          extracted_images: extractedImagesBase64,
          message: `Successfully extracted ${result.extracted_count} figure(s) from the image`
        });

      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        res.status(500).json({ 
          error: 'Failed to parse extraction results',
          details: parseError.message
        });
      }
    });

  } catch (error) {
    console.error('Extract Figures Error:', error);
    res.status(500).json({ 
      error: 'Failed to process image',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 