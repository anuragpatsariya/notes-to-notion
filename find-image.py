import cv2
import os
import sys
import json
import base64
import numpy as np

def extract_images_from_note(input_image_path, output_folder='temp_image_storage'):
    """
    Extract figures/images from handwritten notes or documents using LayoutParser
    
    Args:
        input_image_path: Path to the input image file
        output_folder: Directory to save extracted images
    
    Returns:
        List of paths to extracted images
    """
    # Create output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    try:
        # Try to use layoutparser with detectron2
        import layoutparser as lp
        
        # Try different model initialization methods
        try:
            # Method 1: Try newer API
            model = lp.models.Detectron2LayoutModel(
                'lp://PubLayNet/mask_rcnn_X_101_32x8d_FPN_3x/config',
                extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", 0.5],
                label_map={0: "Text", 1: "Title", 2: "List", 3: "Table", 4: "Figure"}
            )
        except AttributeError:
            # Method 2: Try older API
            try:
                model = lp.Detectron2LayoutModel(
                    'lp://PubLayNet/mask_rcnn_X_101_32x8d_FPN_3x/config',
                    extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", 0.5],
                    label_map={0: "Text", 1: "Title", 2: "List", 3: "Table", 4: "Figure"}
                )
            except:
                # Method 3: Use PaddleOCR backend (simpler, no detectron2 needed)
                raise ImportError("Detectron2 backend not available. Using OpenCV fallback.")
        
        # Read the input image
        image = cv2.imread(input_image_path)
        if image is None:
            raise ValueError(f"Could not read image from {input_image_path}")
        
        # Detect layout
        layout = model.detect(image)
        
        # Filter for images/figures only
        image_blocks = lp.Layout([b for b in layout if b.type == 'Figure'])
        
        # Crop and save images
        extracted_paths = []
        base_filename = os.path.splitext(os.path.basename(input_image_path))[0]
        
        for i, block in enumerate(image_blocks):
            segment_image = block.crop_image(image)
            output_path = os.path.join(output_folder, f'{base_filename}_figure_{i}.jpg')
            cv2.imwrite(output_path, segment_image)
            extracted_paths.append(output_path)
        
        return extracted_paths
        
    except (ImportError, AttributeError) as e:
        # Fallback to simple OpenCV-based contour detection
        print(f"LayoutParser not available, using OpenCV fallback: {e}", file=sys.stderr)
        return extract_images_opencv_fallback(input_image_path, output_folder)

def extract_images_opencv_fallback(input_image_path, output_folder='temp_image_storage'):
    """
    Fallback method using simple OpenCV contour detection
    Detects rectangular regions that might be charts/figures
    
    Args:
        input_image_path: Path to the input image file
        output_folder: Directory to save extracted images
    
    Returns:
        List of paths to extracted images
    """
    os.makedirs(output_folder, exist_ok=True)
    
    # Read the input image
    image = cv2.imread(input_image_path)
    if image is None:
        raise ValueError(f"Could not read image from {input_image_path}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply edge detection
    edges = cv2.Canny(gray, 50, 150)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Get image dimensions
    img_height, img_width = image.shape[:2]
    min_area = (img_width * img_height) * 0.02  # Minimum 2% of image area
    max_area = (img_width * img_height) * 0.8   # Maximum 80% of image area
    
    extracted_paths = []
    base_filename = os.path.splitext(os.path.basename(input_image_path))[0]
    
    figure_count = 0
    for contour in contours:
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        
        # Filter based on area and aspect ratio
        if min_area < area < max_area:
            aspect_ratio = w / h
            # Keep rectangles that look like charts/figures (not too thin)
            if 0.3 < aspect_ratio < 3.0:
                # Extract the region
                segment_image = image[y:y+h, x:x+w]
                output_path = os.path.join(output_folder, f'{base_filename}_figure_{figure_count}.jpg')
                cv2.imwrite(output_path, segment_image)
                extracted_paths.append(output_path)
                figure_count += 1
    
    return extracted_paths

def extract_from_base64(base64_data, output_folder='temp_image_storage', filename='uploaded_image'):
    """
    Extract images from a base64 encoded image
    
    Args:
        base64_data: Base64 encoded image string
        output_folder: Directory to save extracted images
        filename: Base name for the files
    
    Returns:
        List of paths to extracted images
    """
    # Create output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    # Decode base64 to image
    img_data = base64.b64decode(base64_data)
    nparr = np.frombuffer(img_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError("Could not decode base64 image")
    
    # Save the original image temporarily
    temp_path = os.path.join(output_folder, f'{filename}_original.jpg')
    cv2.imwrite(temp_path, image)
    
    # Extract figures from it
    return extract_images_from_note(temp_path, output_folder)

if __name__ == "__main__":
    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage: python find-image.py <input_image_path> [output_folder]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_folder = sys.argv[2] if len(sys.argv) > 2 else 'temp_image_storage'
    
    try:
        extracted = extract_images_from_note(input_path, output_folder)
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