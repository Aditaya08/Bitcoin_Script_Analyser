pub mod services;
pub mod routes;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let router = routes::create_router();

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "4000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("Server running on http://{}", addr);
    axum::serve(listener, router).await?;

    Ok(())
}
