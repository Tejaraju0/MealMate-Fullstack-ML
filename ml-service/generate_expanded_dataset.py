"""
Expanded Restaurant Waste Dataset Generator
Generates comprehensive training data with 200+ diverse food items
for better model generalization across different restaurant types.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

np.random.seed(42)
random.seed(42)

MENU_ITEMS = {
    'meal': [
        # British
        'Fish and Chips', 'Shepherd\'s Pie', 'Bangers and Mash', 'Cottage Pie', 
        'Steak and Kidney Pie', 'Roast Beef', 'Sunday Roast', 'Full English Breakfast',
        # Italian
        'Spaghetti Bolognese', 'Carbonara', 'Lasagne', 'Risotto', 'Pizza Margherita',
        'Pizza Pepperoni', 'Penne Arrabbiata', 'Ravioli', 'Gnocchi',
        # Asian
        'Chicken Curry', 'Thai Green Curry', 'Pad Thai', 'Fried Rice', 'Noodles',
        'Sweet and Sour Chicken', 'Beef in Black Bean', 'Spring Rolls', 'Dumplings',
        # American
        'Burger', 'Cheeseburger', 'Hot Dog', 'Ribs', 'Fried Chicken', 'Mac and Cheese',
        # Mediterranean
        'Falafel', 'Shawarma', 'Kebab', 'Moussaka', 'Greek Salad',
        # Seafood
        'Grilled Salmon', 'Fish Fingers', 'Prawn Cocktail', 'Calamari', 'Tuna Steak',
        # Others
        'Steak', 'Pork Chop', 'Lamb Chops', 'Chicken Breast', 'Meatballs'
    ],
    'snack': [
        'Garlic Bread', 'Chips', 'Nachos', 'Onion Rings', 'Chicken Wings',
        'Mozzarella Sticks', 'Bruschetta', 'Olives', 'Breadsticks', 'Potato Wedges',
        'Popcorn Chicken', 'Crisps', 'Pretzels', 'Cheese Sticks', 'Samosas'
    ],
    'bakery': [
        'Croissant', 'Pain au Chocolat', 'Danish Pastry', 'Muffin', 'Scone',
        'Bagel', 'Doughnut', 'Cookie', 'Brownie', 'Cake Slice',
        'Tart', 'Pie Slice', 'Cupcake', 'Biscuits', 'Roll'
    ],
    'beverages': [
        'Coffee', 'Tea', 'Hot Chocolate', 'Latte', 'Cappuccino',
        'Orange Juice', 'Apple Juice', 'Smoothie', 'Milkshake', 'Soft Drink',
        'Iced Tea', 'Lemonade', 'Water', 'Energy Drink'
    ],
    'desserts': [
        'Ice Cream', 'Tiramisu', 'Cheesecake', 'Apple Pie', 'Chocolate Cake',
        'Pudding', 'Trifle', 'Sundae', 'Sorbet', 'Mousse',
        'Panna Cotta', 'Crème Brûlée', 'Fruit Salad'
    ],
    'sides': [
        'Salad', 'Coleslaw', 'Vegetables', 'Rice', 'Mashed Potato',
        'Roast Potatoes', 'Bread Roll', 'Soup', 'Fries', 'Sweet Potato Fries'
    ]
}

WEATHER_BY_SEASON = {
    'Winter': {'sunny': 0.15, 'rainy': 0.50, 'cloudy': 0.30, 'snowy': 0.05},
    'Spring': {'sunny': 0.35, 'rainy': 0.40, 'cloudy': 0.25, 'snowy': 0.00},
    'Summer': {'sunny': 0.50, 'rainy': 0.25, 'cloudy': 0.25, 'snowy': 0.00},
    'Autumn': {'sunny': 0.30, 'rainy': 0.45, 'cloudy': 0.25, 'snowy': 0.00}
}

UK_BANK_HOLIDAYS = [
    '2024-12-25', '2024-12-26', '2025-01-01', '2025-04-18', '2025-04-21',
    '2025-05-05', '2025-05-26', '2025-08-25',
]

PRICE_RANGES = {
    'meal': (8, 18),
    'snack': (3, 7),
    'bakery': (2, 5),
    'beverages': (2, 5),
    'desserts': (4, 8),
    'sides': (2, 6)
}

def get_season(date):
    month = date.month
    if month in [12, 1, 2]: return 'Winter'
    elif month in [3, 4, 5]: return 'Spring'
    elif month in [6, 7, 8]: return 'Summer'
    else: return 'Autumn'

def is_bank_holiday(date):
    return date.strftime('%Y-%m-%d') in UK_BANK_HOLIDAYS

def get_weather_for_season(season):
    weather_probs = WEATHER_BY_SEASON[season]
    return random.choices(list(weather_probs.keys()), weights=list(weather_probs.values()))[0]

def calculate_waste_percentage(day_of_week, weather, special_event, category, season, is_holiday):
    base_waste = 0.15
    
    if day_of_week in ['Saturday', 'Sunday']:
        base_waste *= 0.8
    elif day_of_week == 'Monday':
        base_waste *= 1.3
    
    if weather == 'rainy':
        base_waste *= 1.2
    elif weather == 'sunny':
        base_waste *= 0.9
    elif weather == 'snowy':
        base_waste *= 1.4
    
    if special_event or is_holiday:
        base_waste *= 1.4
    
    season_factors = {'Winter': 1.1, 'Spring': 1.0, 'Summer': 0.9, 'Autumn': 1.0}
    base_waste *= season_factors[season]
    
    category_factors = {
        'meal': 1.0, 'snack': 0.8, 'bakery': 1.3,
        'beverages': 0.7, 'desserts': 1.2, 'sides': 0.9
    }
    base_waste *= category_factors.get(category, 1.0)
    base_waste *= random.uniform(0.8, 1.2)
    
    return min(base_waste, 0.45)

def generate_quantities(day_of_week, category, season, is_holiday):
    base_quantities = {
        'meal': (40, 60), 'snack': (30, 50), 'bakery': (50, 80),
        'beverages': (30, 50), 'desserts': (20, 40), 'sides': (30, 50)
    }
    
    min_qty, max_qty = base_quantities.get(category, (30, 50))
    
    season_multipliers = {'Winter': 0.9, 'Spring': 1.0, 'Summer': 1.2, 'Autumn': 1.0}
    multiplier = season_multipliers[season]
    min_qty = int(min_qty * multiplier)
    max_qty = int(max_qty * multiplier)
    
    if day_of_week in ['Friday', 'Saturday']:
        min_qty = int(min_qty * 1.3)
        max_qty = int(max_qty * 1.3)
    elif day_of_week == 'Sunday':
        min_qty = int(min_qty * 1.1)
        max_qty = int(max_qty * 1.1)
    elif day_of_week == 'Monday':
        min_qty = int(min_qty * 0.7)
        max_qty = int(max_qty * 0.7)
    
    if is_holiday:
        min_qty = int(min_qty * 1.4)
        max_qty = int(max_qty * 1.4)
    
    return random.randint(min_qty, max_qty)

def generate_expanded_dataset(num_months=12, num_restaurants=10):
    print(f"Generating expanded dataset: {num_months} months, {num_restaurants} restaurants")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=num_months * 30)
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    
    records = []
    
    for restaurant_id in range(1, num_restaurants + 1):
        for category, items in MENU_ITEMS.items():
            restaurant_items = random.sample(items, min(len(items), max(3, len(items) - 2)))
            
            for item_name in restaurant_items:
                for date in date_range:
                    if random.random() < 0.15:
                        continue
                    
                    day_of_week = date.strftime('%A')
                    season = get_season(date)
                    is_holiday = is_bank_holiday(date)
                    
                    special_event_prob = 0.15 if is_holiday else 0.05
                    special_event = random.random() < special_event_prob
                    weather = get_weather_for_season(season)
                    
                    if category == 'bakery':
                        meal_period = random.choice(['breakfast', 'all-day'])
                    elif category == 'meal':
                        meal_period = random.choice(['lunch', 'dinner'])
                    elif category == 'desserts':
                        meal_period = random.choice(['lunch', 'dinner', 'all-day'])
                    else:
                        meal_period = 'all-day'
                    
                    prepared_quantity = generate_quantities(day_of_week, category, season, is_holiday)
                    waste_percentage = calculate_waste_percentage(
                        day_of_week, weather, special_event, category, season, is_holiday
                    )
                    
                    wasted_quantity = int(prepared_quantity * waste_percentage)
                    sold_quantity = prepared_quantity - wasted_quantity
                    
                    min_price, max_price = PRICE_RANGES[category]
                    price_per_unit = round(random.uniform(min_price, max_price), 2)
                    revenue = round(sold_quantity * price_per_unit, 2)
                    potential_revenue_loss = round(wasted_quantity * price_per_unit, 2)
                    
                    notes = f'Generated for {item_name} on {day_of_week}'
                    if is_holiday:
                        notes += ' (Bank Holiday)'
                    
                    record = {
                        'restaurant_id': f'RESTAURANT_{restaurant_id}',
                        'itemName': item_name,
                        'category': category,
                        'date': date.strftime('%Y-%m-%d'),
                        'dayOfWeek': day_of_week,
                        'preparedQuantity': prepared_quantity,
                        'soldQuantity': sold_quantity,
                        'wastedQuantity': wasted_quantity,
                        'wastePercentage': round(waste_percentage * 100, 2),
                        'mealPeriod': meal_period,
                        'weather': weather,
                        'specialEvent': special_event or is_holiday,
                        'revenue': revenue,
                        'potentialRevenueLoss': potential_revenue_loss,
                        'notes': notes
                    }
                    
                    records.append(record)
    
    df = pd.DataFrame(records)
    
    print(f"\nDataset generated successfully")
    print(f"Total records: {len(df):,}")
    print(f"Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"Unique items: {df['itemName'].nunique()}")
    print(f"Categories: {df['category'].nunique()}")
    
    return df

if __name__ == "__main__":
    df = generate_expanded_dataset(num_months=12, num_restaurants=10)
    
    print("\nCategory distribution:")
    print(df['category'].value_counts())
    
    print("\nSample items per category:")
    for category in df['category'].unique():
        items = df[df['category'] == category]['itemName'].unique()[:5]
        print(f"{category}: {', '.join(items)}")
    
    output_filename = 'restaurant_waste_expanded.csv'
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    output_path = os.path.join(data_dir, output_filename)
    df.to_csv(output_path, index=False)
    print(f"\nSaved to: {output_filename}")
