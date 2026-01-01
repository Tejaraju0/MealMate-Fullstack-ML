import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import pickle
import os

def load_and_clean_data(filepath):

    df = pd.read_csv(filepath)
    
    df['date'] = pd.to_datetime(df['date'])
    
    print(f"Total records: {len(df)}")
    print(f"Missing sales values: {df['sales'].isna().sum()}")
    
    df = df.dropna(subset=['sales'])
    
    return df

def create_temporal_features(df):

    df['dayOfWeek'] = df['date'].dt.dayofweek
    
    df['month'] = df['date'].dt.month
    
    df['season'] = df['month'].apply(lambda x: 
        0 if x in [12, 1, 2] else 
        1 if x in [3, 4, 5] else 
        2 if x in [6, 7, 8] else 3
    )
    
    df['is_weekend'] = df['dayOfWeek'].isin([5, 6]).astype(int)
    
    return df

def encode_categorical_features(df):
    le_store = LabelEncoder()
    df['store_encoded'] = le_store.fit_transform(df['store'])
    
    le_state_holiday = LabelEncoder()
    df['state_holiday_encoded'] = le_state_holiday.fit_transform(df['is_state_holiday'])
    
    le_school_holiday = LabelEncoder()
    df['school_holiday_encoded'] = le_school_holiday.fit_transform(df['is_school_holiday'])
    
    le_special_day = LabelEncoder()
    df['special_day_encoded'] = le_special_day.fit_transform(df['is_special_day'])
    
    encoders = {
        'store': le_store,
        'state_holiday': le_state_holiday,
        'school_holiday': le_school_holiday,
        'special_day': le_special_day
    }
    
    return df, encoders

def select_features(df):

    df = df.sort_values('date').reset_index(drop=True)
    
    feature_columns = [
        'store_encoded',              
        'dayOfWeek',                  
        'month',                      
        'season',                     
        'is_weekend',                 
        'temperature_mean',           
        'sunshine_sum',               
        'precipitation_sum',          
        'state_holiday_encoded',      
        'school_holiday_encoded',     
        'special_day_encoded'         
    ]
    
    X = df[feature_columns].copy()
    y = df['sales'].copy()
    
    return X, y, feature_columns

def save_prepared_data(X, y, feature_columns, encoders, output_dir):

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    X.to_csv(os.path.join(output_dir, 'X_features.csv'), index=False)
    y.to_csv(os.path.join(output_dir, 'y_target.csv'), index=False)
    
    with open(os.path.join(output_dir, 'feature_names.pkl'), 'wb') as f:
        pickle.dump(feature_columns, f)
    with open(os.path.join(output_dir, 'encoders.pkl'), 'wb') as f:
        pickle.dump(encoders, f)
    
    print(f"\nData prepared successfully")

def main():

    input_file = 'data/greenai_train.csv'
    output_dir = 'data/prepared'
    
    
    # Step 1: Load data
    df = load_and_clean_data(input_file)
    
    # Step 2: Create temporal features
    df = create_temporal_features(df)
    
    # Step 3: Encode categorical variables
    df, encoders = encode_categorical_features(df)
    
    # Step 4: Select features for modeling
    X, y, feature_columns = select_features(df)
    
    # Step 5: Save prepared data
    save_prepared_data(X, y, feature_columns, encoders, output_dir)
    
    # Print summary statistics
    print("\nFeature Summary:")
    print(X.describe())
    
    print("\nTarget Variable Summary:")
    print(y.describe())

if __name__ == "__main__":
    main()