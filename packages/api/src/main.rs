pub mod services;
pub mod routes;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let router = routes::create_router();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4000").await?;
    println!("Server running on http://0.0.0.0:4000");
    axum::serve(listener, router).await?;

    Ok(())
}
