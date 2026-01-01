import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import pickle
import os

def load_prepared_data(data_dir):

    X = pd.read_csv(os.path.join(data_dir, 'X_features.csv'))
    y = pd.read_csv(os.path.join(data_dir, 'y_target.csv')).values.ravel()
    
    with open(os.path.join(data_dir, 'feature_names.pkl'), 'rb') as f:
        feature_names = pickle.load(f)
      
    return X, y, feature_names

def split_data(X, y, test_size=0.2, random_state=42):

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=True
    )
 
    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples: {len(X_test)}")     
    
    return X_train, X_test, y_train, y_test

def train_gradient_boosting(X_train, y_train):
    print("\nTraining Gradient Boosting model")
    
    model = GradientBoostingRegressor(
        n_estimators=200,        # 200 sequential trees
        max_depth=5,             # Shallower than synthetic
        learning_rate=0.08,      # slow learning
        min_samples_split=10,    # Same regularisation as synthetic
        min_samples_leaf=5,      # Same regularisation as synthetic
        subsample=0.9,           # 90% subsampling for robustness
        random_state=42          # Reproducibility
    )
    
    model.fit(X_train, y_train)
    
    print("Training complete")
    
    return model

def evaluate_model(model, X_train, y_train, X_test, y_test):

    # Get predictions
    y_train_pred = model.predict(X_train)
    y_test_pred = model.predict(X_test)
    
    # Training metrics
    r2_train = r2_score(y_train, y_train_pred)
    
    # Test metrics
    r2_test = r2_score(y_test, y_test_pred)
    mae_test = mean_absolute_error(y_test, y_test_pred)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_test_pred))
    
    print("MODEL PERFORMANCE")
    print(f"Training R²: {r2_train:.4f}")
    print(f"Test R²:     {r2_test:.4f}")  
    print(f"Test MAE:    {mae_test:.4f}")
    print(f"Test RMSE:   {rmse_test:.4f}")

    

    if r2_train - r2_test > 0.15:
        print("Warning: Potential overfitting detected")

    
    metrics = {
        'r2_train': r2_train,
        'r2_test': r2_test,
        'mae_test': mae_test,
        'rmse_test': rmse_test
    }
    
    return metrics, y_test_pred

def perform_cross_validation(model, X, y, cv_folds=5):

    print(f"\nPerforming {cv_folds}-fold cross-validation...")
    
    cv_scores = cross_val_score(
        model, X, y, 
        cv=cv_folds, 
        scoring='r2'
    )
    
    for fold, score in enumerate(cv_scores, 1):
        print(f"  Fold {fold}: R² = {score:.4f}")
    
    print(f"Mean CV R²: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
    
    return cv_scores

def analyze_feature_importance(model, feature_names):

    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nFeature Importance (Top 5):")
    print(importance_df.head().to_string(index=False))
    
    return importance_df

def save_model_and_results(model, metrics, feature_importance, predictions, y_test, output_dir):

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save model
    model_path = os.path.join(output_dir, 'gradient_boosting_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to: {model_path}")
    
    # Save metrics
    metrics_path = os.path.join(output_dir, 'model_metrics.pkl')
    with open(metrics_path, 'wb') as f:
        pickle.dump(metrics, f)
    
    importance_path = os.path.join(output_dir, 'feature_importance.csv')
    feature_importance.to_csv(importance_path, index=False)
    
    predictions_df = pd.DataFrame({
        'actual': y_test,
        'predicted': predictions
    })
    pred_path = os.path.join(output_dir, 'predictions.csv')
    predictions_df.to_csv(pred_path, index=False)
    
    print(f"Results saved to: {output_dir}")

def compare_with_literature(r2_test):

    print("COMPARISON WITH LITERATURE")
    
    benchmarks = [
        ("Rodrigues et al. (2024) - Restaurant catering", 0.72, 0.81),
        ("Aghazadeh (2025) - Airline food", 0.65, 0.75),
        ("This study - Bakery validation", r2_test, r2_test)
    ]
    
    for name, low, high in benchmarks:
        if low == high:
            print(f"{name}: R² = {low:.4f}")
        else:
            print(f"{name}: R² = {low:.4f} - {high:.4f}")
    
    print("="*50)

def main():

    # Paths
    data_dir = 'data/prepared'
    output_dir = 'models/validation'

    
    X, y, feature_names = load_prepared_data(data_dir)
    
    # Split data
    X_train, X_test, y_train, y_test = split_data(X, y)
    
    # Train model
    model = train_gradient_boosting(X_train, y_train)

    metrics, predictions = evaluate_model(model, X_train, y_train, X_test, y_test)
    
    cv_scores = perform_cross_validation(model, X, y)
    
    feature_importance = analyze_feature_importance(model, feature_names)
    
    compare_with_literature(metrics['r2_test'])
    
    save_model_and_results(
        model, metrics, feature_importance, 
        predictions, y_test, output_dir
    )
    
    print("\nTraining pipeline completed successfully")

if __name__ == "__main__":
    main()