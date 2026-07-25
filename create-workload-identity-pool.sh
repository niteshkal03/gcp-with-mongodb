export PROJECT_ID=$(gcloud config get-value project)

echo "Creating Workload Identity Pool..."

gcloud iam workload-identity-pools create github-pool \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# Verify it was created
gcloud iam workload-identity-pools list \
  --project=$PROJECT_ID \
  --location=global

echo "✅ Workload Identity Pool created"
