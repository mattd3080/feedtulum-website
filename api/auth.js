export default function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Get password from request body
  const { password } = req.body;

  // Check if password was provided
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }

  // Get the correct password from environment variable
  const correctPassword = process.env.GRANTS_PASSWORD;

  // Check if environment variable is set
  if (!correctPassword) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  // Compare passwords
  if (password === correctPassword) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
}
