from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import os

app = Flask(__name__)
CORS(app)

color_ranges = {
    "black": [(0, 0, 0), (180, 255, 70)],
    "white": [(0, 0, 200), (180, 60, 255)],
    "gray": [(0, 0, 71), (180, 60, 199)],
    "red1": [(0, 70, 50), (10, 255, 255)],
    "red2": [(170, 70, 50), (180, 255, 255)],
    "orange": [(11, 100, 100), (25, 255, 255)],
    "yellow": [(26, 100, 100), (34, 255, 255)],
    "green": [(35, 50, 50), (85, 255, 255)],
    "cyan": [(86, 100, 100), (95, 255, 255)],
    "blue": [(96, 100, 100), (130, 255, 255)],
    "purple": [(131, 50, 50), (160, 255, 255)],
    "pink": [(161, 50, 50), (169, 255, 255)],
    "brown": [(10, 60, 50), (20, 130, 160)],
    "tan": [(20, 50, 100), (30, 180, 230)],
    "beige": [(15, 30, 120), (25, 100, 255)],
}

def decode_base64_image(base64_data):
    header, encoded = base64_data.split(",", 1)
    img_data = base64.b64decode(encoded)
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img

def calculate_color_percentage(roi):
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    total_pixels = hsv.shape[0] * hsv.shape[1]
    raw_counts = {}
    color_samples = {}

    for color, (lower, upper) in color_ranges.items():
        mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
        count = cv2.countNonZero(mask)
        raw_counts[color] = count

        if count > 0:
            masked_pixels = cv2.bitwise_and(roi, roi, mask=mask)
            pixels = masked_pixels[np.where(mask != 0)]
            if len(pixels) > 0:
                avg_color = np.mean(pixels, axis=0).astype(int).tolist()  # BGR
                color_samples[color] = avg_color[::-1]  # Convert to RGB

    red_total = raw_counts.get('red1', 0) + raw_counts.get('red2', 0)
    if red_total > 0:
        raw_counts['red'] = red_total
        r_pixels = []
        for key in ['red1', 'red2']:
            mask = cv2.inRange(hsv, np.array(color_ranges[key][0]), np.array(color_ranges[key][1]))
            masked = cv2.bitwise_and(roi, roi, mask=mask)
            r_pixels.append(masked[np.where(mask != 0)])
        red_pixels = np.concatenate(r_pixels) if r_pixels else []
        if len(red_pixels) > 0:
            color_samples['red'] = np.mean(red_pixels, axis=0).astype(int).tolist()[::-1]
    raw_counts.pop('red1', None)
    raw_counts.pop('red2', None)
    color_samples.pop('red1', None)
    color_samples.pop('red2', None)

    filtered = {color: count for color, count in raw_counts.items() if count > 0}
    total_color_pixels = sum(filtered.values())

    if total_color_pixels == 0:
        return {}

    percentages = {
        color: round((count / total_color_pixels) * 100, 2)
        for color, count in filtered.items()
    }

    total_percent = sum(percentages.values())
    if percentages and total_percent != 100:
        diff = round(100 - total_percent, 2)
        max_color = max(percentages, key=percentages.get)
        percentages[max_color] = round(percentages[max_color] + diff, 2)

    results = {
        color: {
            "percent": percentages[color],
            "rgb": color_samples.get(color, [0, 0, 0])
        }
        for color in percentages
    }

    return results

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400

    try:
        image = decode_base64_image(data['image'])
        results = calculate_color_percentage(image)
        return jsonify({"colors": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
