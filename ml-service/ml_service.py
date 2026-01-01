from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'waste_prediction_model_gb.pkl')
ENCODER_PATH = os.path.join(BASE_DIR, 'models', 'feature_encoders.pkl')

# Load model at startup
print(f"Loading model from: {MODEL_PATH}")
model = joblib.load(MODEL_PATH)
encoders = joblib.load(ENCODER_PATH)
print("Model loaded successfully")

def get_season(month):
    if month in [12, 1, 2]:
        return 'Winter'
    elif month in [3, 4, 5]:
        return 'Spring'
    elif month in [6, 7, 8]:
        return 'Summer'
    else:
        return 'Autumn'

def get_category_item(category, known_items):
    """Get representative item for category."""
    for item in known_items:
        if 'Burger' in item or 'Fish' in item or 'Chicken' in item:
            if category == 'meal':
                return item
        if 'Chips' in item or 'Bread' in item:
            if category == 'snack':
                return item
        if 'Scone' in item or 'Croissant' in item:
            if category == 'bakery':
                return item
        if 'Juice' in item or 'Coffee' in item:
            if category == 'beverages':
                return item
        if 'Cake' in item or 'Ice Cream' in item:
            if category == 'desserts':
                return item
        if 'Salad' in item or 'Soup' in item:
            if category == 'sides':
                return item
    return known_items[0]

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'ML Prediction Service',
        'model_loaded': model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        
        item_name = data.get('itemName')
        category = data.get('category')
        day_of_week = data.get('dayOfWeek')
        meal_period = data.get('mealPeriod', 'all-day')
        weather = data.get('weather', 'cloudy')
        special_event = data.get('specialEvent', False)
        prepared_qty = data.get('preparedQuantity')
        
        if 'date' in data:
            date_obj = datetime.strptime(data['date'], '%Y-%m-%d')
            month = date_obj.month
        else:
            month = datetime.now().month
        
        season = get_season(month)
        
        known_items = encoders['itemName'].classes_
        
        if item_name in known_items:
            item_encoded = encoders['itemName'].transform([item_name])[0]
            confidence = "high"
            prediction_type = "item-based"
        else:
            category_item = get_category_item(category, known_items)
            item_encoded = encoders['itemName'].transform([category_item])[0]
            confidence = "medium"
            prediction_type = "category-based"
        
        input_data = pd.DataFrame({
            'itemName_encoded': [item_encoded],
            'category_encoded': [encoders['category'].transform([category])[0]],
            'dayOfWeek_encoded': [encoders['dayOfWeek'].transform([day_of_week])[0]],
            'mealPeriod_encoded': [encoders['mealPeriod'].transform([meal_period])[0]],
            'weather_encoded': [encoders['weather'].transform([weather])[0]],
            'season_encoded': [encoders['season'].transform([season])[0]],
            'specialEvent_encoded': [1 if special_event else 0],
            'month': [month],
            'preparedQuantity': [prepared_qty]
        })
        
        prediction = model.predict(input_data)[0]
        suggested_qty = int(prepared_qty * (1 - prediction/100))
        
        return jsonify({
            'success': True,
            'wastePercentage': round(prediction, 2),
            'confidence': confidence,
            'predictionType': prediction_type,
            'suggestedQuantity': suggested_qty,
            'message': f'Prediction based on {prediction_type} patterns'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

if __name__ == '__main__':
    print("ML Prediction Service Starting")
    print(f"Model path: {MODEL_PATH}")
    print(f"Encoder path: {ENCODER_PATH}")
    print("Listening on: http://localhost:5001")
    
    app.run(host='0.0.0.0', port=5001, debug=False)
