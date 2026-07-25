export PROJECT_ID="project-93292acb-1b2a-49eb-8cd"

# Delete old provider (if exists)
gcloud iam workload-identity-pools providers delete github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --quiet 2>/dev/null || true

# Delete old pool (if exists)
gcloud iam workload-identity-pools delete github-pool \
  --project=$PROJECT_ID \
  --location=global \
  --quiet 2>/dev/null || true

echo "✅ Old setup cleaned"
