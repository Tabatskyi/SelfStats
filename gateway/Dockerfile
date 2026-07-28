FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o gateway main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/gateway .

EXPOSE 8080

CMD ["./gateway"]
