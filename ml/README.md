# 선택 실험: QLoRA 의도·근거 설명 모델

이 폴더는 수업의 PEFT/LoRA 학습성과를 재현하기 위한 선택 실험이다. 졸업 규칙이나 학점 값을 모델에 암기시키지 않고, 질문 의도와 호출할 도구를 안정적으로 출력하도록 학습한다.

## 환경

- Python 3.10+
- CUDA GPU 권장(Colab T4 이상)
- `transformers`, `datasets`, `peft`, `trl`, `bitsandbytes`, `accelerate`

```bash
pip install transformers datasets peft trl bitsandbytes accelerate
python ml/train_qlora.py \
  --model Qwen/Qwen2.5-3B-Instruct \
  --data ml/data/intent_train.jsonl \
  --output ml/outputs/gradcompass-lora
```

학습 산출물은 크기가 크므로 저장소에 커밋하지 않는다. 학습 전후로 `evaluation/run-eval.ts`의 의도 세트와 별도의 생성 품질 세트를 비교한다.
