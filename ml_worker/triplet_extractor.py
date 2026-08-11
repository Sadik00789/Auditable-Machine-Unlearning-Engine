import logging
from typing import List, Dict
import spacy

logger = logging.getLogger("ml_worker.triplet_extractor")

class TripletExtractor:
    def __init__(self, model_name: str = "en_core_web_sm"):
        logger.info(f"Loading spaCy model '{model_name}'...")
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            logger.warning(f"SpaCy model '{model_name}' not found locally. Downloading...")
            spacy.cli.download(model_name)
            self.nlp = spacy.load(model_name)

    def extract(self, text: str) -> List[Dict[str, str]]:
        if not text or not text.strip():
            return []
        
        doc = self.nlp(text)
        triplets = []

        for sent in doc.sents:
            subject = ""
            predicate = ""
            obj = ""
            for token in sent:
                if "subj" in token.dep_:
                    subject = token.text
                elif token.pos_ == "VERB":
                    predicate = token.lemma_
                elif "obj" in token.dep_:
                    obj = token.text
                
                if subject and predicate and obj:
                    triplets.append({
                        "subject": subject,
                        "predicate": predicate.upper(),
                        "object": obj
                    })
                    subject, predicate, obj = "", "", ""

        if not triplets:
            nouns = [token.text for token in doc if token.pos_ in ("NOUN", "PROPN")]
            verbs = [token.lemma_ for token in doc if token.pos_ == "VERB"]
            if len(nouns) >= 2 and verbs:
                triplets.append({
                    "subject": nouns[0],
                    "predicate": verbs[0].upper(),
                    "object": nouns[1]
                })
            elif len(nouns) >= 1:
                triplets.append({
                    "subject": nouns[0],
                    "predicate": "ASSOCIATED_WITH",
                    "object": doc.text[:30]
                })

        return triplets