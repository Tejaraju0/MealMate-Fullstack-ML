import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODEL_DIR = os.path.join(BASE_DIR, 'models')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

CSV_PATH = os.path.join(DATA_DIR, 'restaurant_waste_expanded.csv')
MODEL_PATH = os.path.join(MODEL_DIR, 'waste_prediction_model.pkl')
ENCODER_PATH = os.path.join(MODEL_DIR, 'feature_encoders.pkl')
INFO_PATH = os.path.join(MODEL_DIR, 'model_info.pkl')
CHART_PATH = os.path.join(MODEL_DIR, 'model_performance.png')

print(f"Loading dataset from: {CSV_PATH}")
df = pd.read_csv(CSV_PATH)
print(f"Loaded {len(df):,} records with {df['itemName'].nunique()} unique items\n")

encoders = {}
categorical_columns = ['itemName', 'category', 'dayOfWeek', 'mealPeriod', 'weather']

for col in categorical_columns:
    encoders[col] = LabelEncoder()
    df[col + '_encoded'] = encoders[col].fit_transform(df[col])

df['specialEvent_encoded'] = df['specialEvent'].map({True: 1, False: 0})

df['date'] = pd.to_datetime(df['date'])
df['month'] = df['date'].dt.month
df['season'] = df['date'].dt.month.map({
    12: 'Winter', 1: 'Winter', 2: 'Winter',
    3: 'Spring', 4: 'Spring', 5: 'Spring',
    6: 'Summer', 7: 'Summer', 8: 'Summer',
    9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
})
encoders['season'] = LabelEncoder()
df['season_encoded'] = encoders['season'].fit_transform(df['season'])

feature_columns = [
    'itemName_encoded', 'category_encoded', 'dayOfWeek_encoded',
    'mealPeriod_encoded', 'weather_encoded', 'season_encoded',
    'specialEvent_encoded', 'month', 'preparedQuantity'
]

X = df[feature_columns]
y = df['wastePercentage']

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"Training: {len(X_train):,} | Test: {len(X_test):,}")

# Train model
print("Training model...")
model = RandomForestRegressor(
    n_estimators=100,
    max_depth=20,
    min_samples_split=10,
    min_samples_leaf=5,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# Predictions
y_train_pred = model.predict(X_train)
y_test_pred = model.predict(X_test)

# Metrics
train_mae = mean_absolute_error(y_train, y_train_pred)
train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
train_r2 = r2_score(y_train, y_train_pred)

test_mae = mean_absolute_error(y_test, y_test_pred)
test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
test_r2 = r2_score(y_test, y_test_pred)

print("\nPerformance Results")
print("-" * 50)
print(f"Training   - MAE: {train_mae:.2f}% | RMSE: {train_rmse:.2f}% | R²: {train_r2:.4f}")
print(f"Test       - MAE: {test_mae:.2f}% | RMSE: {test_rmse:.2f}% | R²: {test_r2:.4f}")

# Feature importance
feature_importance = pd.DataFrame({
    'feature': feature_columns,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print("\nTop Features:")
for idx, row in feature_importance.head(5).iterrows():
    print(f"  {row['feature'].replace('_encoded', '')}: {row['importance']:.4f}")

# Visualization
fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# Actual vs Predicted
axes[0, 0].scatter(y_test, y_test_pred, alpha=0.3, s=5)
axes[0, 0].plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
axes[0, 0].set_xlabel('Actual Waste %')
axes[0, 0].set_ylabel('Predicted Waste %')
axes[0, 0].set_title('Predictions vs Actual')
axes[0, 0].grid(alpha=0.3)

# Error distribution
errors = y_test - y_test_pred
axes[0, 1].hist(errors, bins=50, edgecolor='black', alpha=0.7)
axes[0, 1].axvline(x=0, color='r', linestyle='--', lw=2)
axes[0, 1].set_xlabel('Error (%)')
axes[0, 1].set_ylabel('Frequency')
axes[0, 1].set_title('Prediction Errors')
axes[0, 1].grid(alpha=0.3)

# Feature importance
top_features = feature_importance.head(8)
axes[1, 0].barh(range(len(top_features)), top_features['importance'])
axes[1, 0].set_yticks(range(len(top_features)))
axes[1, 0].set_yticklabels([f.replace('_encoded', '') for f in top_features['feature']])
axes[1, 0].set_xlabel('Importance')
axes[1, 0].set_title('Feature Importance')
axes[1, 0].grid(alpha=0.3, axis='x')

# Performance comparison
x_pos = np.arange(3)
train_metrics = [train_mae, train_rmse, train_r2]
test_metrics = [test_mae, test_rmse, test_r2]
width = 0.35

axes[1, 1].bar(x_pos - width/2, train_metrics, width, label='Train', alpha=0.8)
axes[1, 1].bar(x_pos + width/2, test_metrics, width, label='Test', alpha=0.8)
axes[1, 1].set_xticks(x_pos)
axes[1, 1].set_xticklabels(['MAE', 'RMSE', 'R²'])
axes[1, 1].set_title('Train vs Test')
axes[1, 1].legend()
axes[1, 1].grid(alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig(CHART_PATH, dpi=300, bbox_inches='tight')
print(f"\nVisualization saved: {CHART_PATH}")

# Save model
joblib.dump(model, MODEL_PATH)
joblib.dump(encoders, ENCODER_PATH)
joblib.dump({'features': feature_columns, 'target': 'wastePercentage'}, INFO_PATH)

print("\nModel files saved to models/ folder:")
print(f"  - {os.path.basename(MODEL_PATH)}")
print(f"  - {os.path.basename(ENCODER_PATH)}")
print(f"  - {os.path.basename(INFO_PATH)}")
