import { useState } from "react";

export default function Upload() {
  const [video, setVideo] = useState(null);
  const [videoURL, setVideoURL] = useState('');
  
  const [caption, setCaption] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  


  return <div>Upload goes here</div>
}