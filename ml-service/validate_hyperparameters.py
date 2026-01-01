import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import GradientBoostingRegressor
import os
import time

def load_synthetic_data():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    CSV_PATH = os.path.join(DATA_DIR, 'restaurant_waste_expanded.csv')
    
    print(f"Loading dataset from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df):,} records\n")
    
    return df

def prepare_features(df):
    from sklearn.preprocessing import LabelEncoder
    
    # Encode categorical variables
    encoders = {}
    categorical_columns = ['itemName', 'category', 'dayOfWeek', 'mealPeriod', 'weather']
    
    for col in categorical_columns:
        encoders[col] = LabelEncoder()
        df[col + '_encoded'] = encoders[col].fit_transform(df[col])
    
    df['specialEvent_encoded'] = df['specialEvent'].map({True: 1, False: 0})
    
    # Extract temporal features
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
    
    # Define features
    feature_columns = [
        'itemName_encoded', 'category_encoded', 'dayOfWeek_encoded',
        'mealPeriod_encoded', 'weather_encoded', 'season_encoded',
        'specialEvent_encoded', 'month', 'preparedQuantity'
    ]
    
    X = df[feature_columns]
    y = df['wastePercentage']
    
    return X, y

def main():
     
    # Load and prepare data
    df = load_synthetic_data()
    X, y = prepare_features(df)
    
    print("Using 10% subset for grid search (faster validation)")
    X_subset, _, y_subset, _ = train_test_split(
        X, y, train_size=0.1, random_state=42
    )
    print(f"Subset size: {len(X_subset):,} samples\n")
    
    param_grid = {
        'max_depth': [5, 8, 10],              
        'learning_rate': [0.05, 0.08, 0.1],   # Learning speed
        'n_estimators': [100, 200],           # Number of trees
        'min_samples_split': [10],            
        'min_samples_leaf': [5],              
        'subsample': [0.9]                   
    }
    
    print("Grid search parameters:")
    for param, values in param_grid.items():
        print(f"  {param}: {values}")
    
    total_combinations = (
        len(param_grid['max_depth']) * 
        len(param_grid['learning_rate']) * 
        len(param_grid['n_estimators'])
    )
    print(f"\nTotal combinations to test: {total_combinations}")
    
    # Run grid search
    start_time = time.time()
    
    grid_search = GridSearchCV(
        GradientBoostingRegressor(random_state=42),
        param_grid,
        cv=3,                    
        scoring='r2',
        n_jobs=-1,               
        verbose=1                
    )
    
    print("Running grid search")
    grid_search.fit(X_subset, y_subset)

    elapsed_time = time.time() - start_time

    print(f"\nBest R²: {grid_search.best_score_:.4f}")
    print(f"Best params: {grid_search.best_params_}")
    print(f"Time: {elapsed_time:.1f}s")

    print("\nTop 3 configurations:")

    results_df = pd.DataFrame(grid_search.cv_results_)
    results_df = results_df.sort_values('rank_test_score')

    for i in range(min(3, len(results_df))):
        row = results_df.iloc[i]
        print(f"  {i+1}. R²={row['mean_test_score']:.4f}, depth={row['param_max_depth']}, lr={row['param_learning_rate']}, trees={row['param_n_estimators']}")

    my_params = {
        'max_depth': 8,
        'learning_rate': 0.08,
        'n_estimators': 200
    }

    print(f"\nChosen params: {my_params}")

    params_match = all(
        grid_search.best_params_[k] == v
        for k, v in my_params.items()
    )

    if params_match:
        print("Matches grid search optimum")
    else:
        best_r2 = grid_search.best_score_

        my_model = GradientBoostingRegressor(
            max_depth=my_params['max_depth'],
            learning_rate=my_params['learning_rate'],
            n_estimators=my_params['n_estimators'],
            min_samples_split=10,
            min_samples_leaf=5,
            subsample=0.9,
            random_state=42
        )

        from sklearn.model_selection import cross_val_score
        my_scores = cross_val_score(
            my_model, X_subset, y_subset, cv=3, scoring='r2'
        )
        my_r2 = my_scores.mean()

        print(f"Chosen R²: {my_r2:.4f} vs Best: {best_r2:.4f}")

        diff = abs(best_r2 - my_r2)
        if diff < 0.02:
            print(f"Difference: {diff:.4f} (acceptable)")
        else:
            print(f"Difference: {diff:.4f}")

if __name__ == "__main__":
    main()