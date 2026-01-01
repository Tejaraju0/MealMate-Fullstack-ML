import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
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

    return X_train, X_test, y_train, y_test

def train_random_forest(X_train, y_train):
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_train, y_train)

    return model

def evaluate_model(model, X_train, y_train, X_test, y_test):
    y_train_pred = model.predict(X_train)
    r2_train = r2_score(y_train, y_train_pred)

    y_test_pred = model.predict(X_test)
    r2_test = r2_score(y_test, y_test_pred)
    mae_test = mean_absolute_error(y_test, y_test_pred)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_test_pred))

    print("RANDOM FOREST PERFORMANCE")
    print(f"Training R²: {r2_train:.4f}")
    print(f"Test R²:     {r2_test:.4f}")
    print(f"Test MAE:    {mae_test:.4f}")
    print(f"Test RMSE:   {rmse_test:.4f}")

    if r2_train - r2_test > 0.15:
        print("Warning: Potential overfitting detected")
        print(f"Gap between training and test R²: {r2_train - r2_test:.4f}")

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

def save_results(model, metrics, feature_importance, predictions, y_test, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    model_path = os.path.join(output_dir, 'random_forest_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to: {model_path}")

    metrics_path = os.path.join(output_dir, 'rf_model_metrics.pkl')
    with open(metrics_path, 'wb') as f:
        pickle.dump(metrics, f)

    importance_path = os.path.join(output_dir, 'rf_feature_importance.csv')
    feature_importance.to_csv(importance_path, index=False)

    predictions_df = pd.DataFrame({
        'actual': y_test,
        'predicted': predictions
    })
    pred_path = os.path.join(output_dir, 'rf_predictions.csv')
    predictions_df.to_csv(pred_path, index=False)

    print(f"Results saved to: {output_dir}")

def compare_with_gradient_boosting(rf_r2):
    print("ALGORITHM COMPARISON (Real Data)")
    print(f"Random Forest:     R² = {rf_r2:.4f}")
    print(f"Gradient Boosting: R² = 0.7527")

    improvement = ((0.7527 - rf_r2) / rf_r2) * 100
    print(f"GB Improvement:    {improvement:+.1f}%")

def main():
    data_dir = 'data/prepared'
    output_dir = 'models/validation'

    print("Starting Random Forest training on real bakery data")

    X, y, feature_names = load_prepared_data(data_dir)

    X_train, X_test, y_train, y_test = split_data(X, y)

    model = train_random_forest(X_train, y_train)

    metrics, predictions = evaluate_model(model, X_train, y_train, X_test, y_test)

    cv_scores = perform_cross_validation(model, X, y)

    feature_importance = analyze_feature_importance(model, feature_names)

    compare_with_gradient_boosting(metrics['r2_test'])

    save_results(
        model, metrics, feature_importance,
        predictions, y_test, output_dir
    )

    print("\nRandom Forest training completed")

if __name__ == "__main__":
    main()