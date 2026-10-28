FROM alpine:3.22
RUN apk add --no-cache gcc g++ musl-dev python3 gdb
COPY execute.py /opt/codewise/execute.py
COPY trace_python.py /opt/codewise/trace_python.py
COPY trace_native.py /opt/codewise/trace_native.py
WORKDIR /work
USER 65534:65534
ENTRYPOINT ["python3", "-I", "/opt/codewise/execute.py"]
