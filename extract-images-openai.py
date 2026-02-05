#!/usr/bin/env python3
"""
Alternative figure extractor using OpenAI Vision API
This is simpler and doesn't require detectron2
"""
import cv2
import os
import sys
import json
import base64
from dotenv import load_dotenv
import requests

load_dotenv()

def encode_image_to_base64(image_path):
    """Encode image to base64"""
    with open(image_path, 'rb') as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def detect_figure_regions_with_openai(image_path):
    """
    Use OpenAI to detect regions containing figures/charts
    Returns list of bounding boxes
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    
    base64_image = encode_image_to_base64(image_path)
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Analyze this image and identify any charts, graphs, diagrams, tables, or figures.
For each visual element found, provide the location as percentages of the image dimensions.

IMPORTANT: Make the bounding box GENEROUS - include some margin around each figure to avoid cutting off any content.

Return ONLY valid JSON in this exact format:
{
  "figures": [
    {
      "type": "chart_type",
      "description": "brief description",
      "bbox": {
        "x": 10,
        "y": 20,
        "width": 30,
        "height": 40
      }
    }
  ]
}

Where:
- x: left edge position (0-100% of image width)
- y: top edge position (0-100% of image height)  
- width: width of the region (0-100% of image width)
- height: height of the region (0-100% of image height)

Be generous with the bounding boxes to capture the complete figure.
If no figures are found, return: {"figures": []}"""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000
    }
    
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=payload
    )
    
    if response.status_code != 200:
        raise Exception(f"OpenAI API error: {response.text}")
    
    content = response.json()['choices'][0]['message']['content']
    
    # Clean up markdown formatting if present
    content = content.replace('```json', '').replace('```', '').strip()
    
    return json.loads(content)

def extract_figures_from_image(image_path, output_folder='temp_image_storage', padding_percent=8):
    """
    Extract figures from image using OpenAI for detection
    
    Args:
        image_path: Path to input image
        output_folder: Where to save extracted figures
        padding_percent: Percentage of padding to add around detected regions (default 8%)
    """
    os.makedirs(output_folder, exist_ok=True)
    
    # Get figure locations from OpenAI
    print("Analyzing image with OpenAI...", file=sys.stderr)
    result = detect_figure_regions_with_openai(image_path)
    
    figures = result.get('figures', [])
    if not figures:
        return []
    
    # Load the image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image from {image_path}")
    
    img_height, img_width = image.shape[:2]
    
    extracted_paths = []
    base_filename = os.path.splitext(os.path.basename(image_path))[0]
    
    for i, figure in enumerate(figures):
        bbox = figure.get('bbox', {})
        
        # Convert percentages to pixel coordinates
        x = int(bbox.get('x', 0) * img_width / 100)
        y = int(bbox.get('y', 0) * img_height / 100)
        w = int(bbox.get('width', 100) * img_width / 100)
        h = int(bbox.get('height', 100) * img_height / 100)
        
        # Add padding around the detected region
        padding_x = int(w * padding_percent / 100)
        padding_y = int(h * padding_percent / 100)
        
        # Apply padding
        x = x - padding_x
        y = y - padding_y
        w = w + (padding_x * 2)
        h = h + (padding_y * 2)
        
        # Ensure coordinates are within image bounds
        x = max(0, x)
        y = max(0, y)
        w = min(w, img_width - x)
        h = min(h, img_height - y)
        
        # Extract and save the region
        if w > 0 and h > 0:
            segment = image[y:y+h, x:x+w]
            output_path = os.path.join(output_folder, f'{base_filename}_figure_{i}.jpg')
            cv2.imwrite(output_path, segment)
            extracted_paths.append(output_path)
            print(f"Extracted figure {i}: {figure.get('type', 'unknown')} - {figure.get('description', 'no description')}", file=sys.stderr)
    
    return extracted_paths

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract-images-openai.py <input_image_path> [output_folder] [padding_percent]")
        print("\nExamples:")
        print("  python extract-images-openai.py my-notes.jpg")
        print("  python extract-images-openai.py my-notes.jpg temp_image_storage")
        print("  python extract-images-openai.py my-notes.jpg temp_image_storage 20")
        print("\npadding_percent: Add extra margin around figures (default 8%)")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_folder = sys.argv[2] if len(sys.argv) > 2 else 'temp_image_storage'
    padding_percent = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    
    try:
        extracted = extract_figures_from_image(input_path, output_folder, padding_percent)
        result = {
            "success": True,
            "extracted_count": len(extracted),
            "extracted_images": extracted
        }
        print(json.dumps(result))
    except Exception as e:
        result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(result))
        sys.exit(1)
