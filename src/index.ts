import app from './github-server';

// Start the server
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Github Agent server running on port ${PORT}`);
});
