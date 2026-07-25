export PROJECT_ID=$(gcloud config get-value project)

echo "Creating OIDC Provider..."

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"

# Verify it was created
gcloud iam workload-identity-pools providers list \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool

echo "✅ OIDC Provider created"
