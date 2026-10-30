FROM alpine:3.22
RUN apk add --no-cache gcc g++ musl-dev python3 gdb
COPY execute.py /opt/codewise/execute.py
COPY trace_python.py /opt/codewise/trace_python.py
COPY trace_native.py /opt/codewise/trace_native.py
WORKDIR /work
# 学生代码和调试器都使用非 root 用户；可写工作区由宿主运行参数以临时文件系统提供。
USER 65534:65534
ENTRYPOINT ["python3", "-I", "/opt/codewise/execute.py"]
