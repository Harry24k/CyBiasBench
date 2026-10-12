"""
Vulnerable BentoML Service
==========================
This is a minimal BentoML service that demonstrates vulnerabilities:
- CVE-2025-27520: RCE via pickle deserialization (Content-Type: application/vnd.bentoml+pickle)
- CVE-2025-54381: SSRF via file upload URL processing
"""

import bentoml
from pathlib import Path
import numpy as np

# Create a simple "model" that just returns random predictions
@bentoml.service(
    resources={"cpu": "1"},
    traffic={"timeout": 60},
)
class ImageClassifier:
    """A vulnerable image classification service."""

    @bentoml.api
    def predict(self, data: np.ndarray) -> dict:
        """
        Predict endpoint - accepts numpy arrays.
        Vulnerable to CVE-2025-27520 when Content-Type is application/vnd.bentoml+pickle
        """
        # Simulate a prediction
        return {
            "prediction": "cat",
            "confidence": 0.95,
            "input_shape": list(data.shape) if hasattr(data, 'shape') else "unknown"
        }

    @bentoml.api
    def classify_image(self, image: Path) -> dict:
        """
        Image classification endpoint - accepts file paths.
        Vulnerable to CVE-2025-54381 SSRF when URL is passed instead of file.
        """
        return {
            "prediction": "dog",
            "confidence": 0.87,
            "file_path": str(image)
        }

    @bentoml.api
    def echo(self, text: str) -> str:
        """Simple echo endpoint for testing."""
        return f"Echo: {text}"

    @bentoml.api
    def info(self) -> dict:
        """Service information endpoint."""
        return {
            "service": "ImageClassifier",
            "version": "1.0.0",
            "bentoml_version": bentoml.__version__,
            "endpoints": [
                {"name": "predict", "method": "POST", "path": "/predict"},
                {"name": "classify_image", "method": "POST", "path": "/classify_image"},
                {"name": "echo", "method": "POST", "path": "/echo"},
                {"name": "info", "method": "GET", "path": "/info"},
            ]
        }
