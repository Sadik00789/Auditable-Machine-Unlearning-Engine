import signal
import logging
from concurrent import futures
import grpc
from grpc_reflection.v1alpha import reflection

import ml_service_pb2
import ml_service_pb2_grpc
from embedder import Embedder
from triplet_extractor import TripletExtractor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ml_worker")

class MlInferenceServicer(ml_service_pb2_grpc.MlInferenceServicer):
    def __init__(self):
        self.embedder = Embedder()
        self.extractor = TripletExtractor()

    def GenerateEmbeddings(self, request, context):
        try:
            vector = self.embedder.encode(request.text)
            return ml_service_pb2.EmbedResponse(vector=vector, dimension=len(vector))
        except ValueError as e:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))
        except Exception as e:
            logger.error(f"GenerateEmbeddings exception: {e}")
            context.abort(grpc.StatusCode.INTERNAL, "Failed to generate embeddings.")

    def ExtractTriplets(self, request, context):
        try:
            raw_triplets = self.extractor.extract(request.text)
            pb_triplets = [
                ml_service_pb2.Triplet(
                    subject=t["subject"],
                    predicate=t["predicate"],
                    object=t["object"]
                )
                for t in raw_triplets
            ]
            return ml_service_pb2.ExtractResponse(triplets=pb_triplets)
        except Exception as e:
            logger.error(f"ExtractTriplets exception: {e}")
            context.abort(grpc.StatusCode.INTERNAL, "Failed to extract triplets.")

    def IngestBatch(self, request, context):
        try:
            items = request.items
            if not items:
                return ml_service_pb2.BatchIngestResponse(results=[])

            texts = [item.text for item in items]
            vectors = self.embedder.encode_batch(texts)

            results = []
            for item, vector in zip(items, vectors):
                raw_triplets = self.extractor.extract(item.text)
                pb_triplets = [
                    ml_service_pb2.Triplet(
                        subject=t["subject"],
                        predicate=t["predicate"],
                        object=t["object"]
                    )
                    for t in raw_triplets
                ]
                results.append(
                    ml_service_pb2.SingleIngestResult(
                        id=item.id,
                        entity_id=item.entity_id,
                        vector=vector,
                        triplets=pb_triplets,
                    )
                )

            return ml_service_pb2.BatchIngestResponse(results=results)
        except Exception as e:
            logger.error(f"IngestBatch exception: {e}")
            context.abort(grpc.StatusCode.INTERNAL, f"Batch ingestion failed: {e}")

    def HealthCheck(self, request, context):
        return ml_service_pb2.HealthCheckResponse(
            status=ml_service_pb2.ServingStatus.SERVING
        )

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    ml_service_pb2_grpc.add_MlInferenceServicer_to_server(MlInferenceServicer(), server)

    SERVICE_NAMES = (
        ml_service_pb2.DESCRIPTOR.services_by_name['MlInference'].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(SERVICE_NAMES, server)

    port = 50051
    server.add_insecure_port(f"[::]:{port}")
    logger.info(f"Production Python ML gRPC Worker listening on port {port}")
    server.start()

    def handle_shutdown(signum, frame):
        logger.info("Received termination signal. Shutting down gRPC server gracefully...")
        server.stop(grace=5)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    server.wait_for_termination()

if __name__ == "__main__":
    serve()