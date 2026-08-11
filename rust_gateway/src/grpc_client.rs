pub mod ml_service {
    tonic::include_proto!("ml_service");
}

use ml_service::ml_inference_client::MlInferenceClient;
use ml_service::{EmbedRequest, ExtractRequest, Triplet as PbTriplet};
use std::time::Duration;
use thiserror::Error;
use tonic::transport::{Channel, Endpoint};
use tracing::info;

#[derive(Error, Debug)]
pub enum MlClientError {
    #[error("Transport error: {0}")]
    Transport(#[from] tonic::transport::Error),
    #[error("Invalid URI error: {0}")]
    InvalidUri(#[from] tonic::codegen::http::uri::InvalidUri),
    #[error("RPC error: {0}")]
    Status(#[from] tonic::Status),
}

#[derive(Debug, Clone)]
pub struct ExtractedTriplet {
    pub subject: String,
    pub predicate: String,
    pub object: String,
}

#[derive(Clone)]
pub struct MlClient {
    client: MlInferenceClient<Channel>,
}

impl MlClient {
    pub async fn connect(endpoint: String) -> Result<Self, MlClientError> {
        info!("Connecting to ML Worker gRPC endpoint at {}", endpoint);
        
        let channel = Endpoint::from_shared(endpoint)?
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .connect_lazy();
        
        let client = MlInferenceClient::new(channel);
        Ok(Self { client })
    }

    pub async fn get_embedding(&self, text: String) -> Result<Vec<f32>, MlClientError> {
        let mut client = self.client.clone();
        let request = tonic::Request::new(EmbedRequest { text });
        
        let response = client.generate_embeddings(request).await?;
        Ok(response.into_inner().vector)
    }

    pub async fn extract_triplets(&self, text: String) -> Result<Vec<ExtractedTriplet>, MlClientError> {
        let mut client = self.client.clone();
        let request = tonic::Request::new(ExtractRequest { text });

        let response = client.extract_triplets(request).await?;
        let triplets = response
            .into_inner()
            .triplets
            .into_iter()
            .map(|t: PbTriplet| ExtractedTriplet {
                subject: t.subject,
                predicate: t.predicate,
                object: t.object,
            })
            .collect();

        Ok(triplets)
    }
}