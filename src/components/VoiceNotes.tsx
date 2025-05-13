import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Mic, MicOff, Trash2, Edit2, Save, Sun, Moon, Download, Hash, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { jsPDF } from 'jspdf';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
import { LoginPage } from './LoginPage';

interface Note {
  id: string;
  text: string;
  timestamp: Date;
  tags: string[];
  userId: string;
}

export function VoiceNotes() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        tags: doc.data().tags || [],
      })) as Note[];
      setNotes(newNotes);

      // Extract unique tags
      const allTags = Array.from(new Set(newNotes.flatMap(note => note.tags)));
      setTags(allTags);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          setTranscript((prev) => prev + ' ' + transcript);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event);
          setIsRecording(false);
        };

        setRecognition(recognition);
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
      }
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      setTranscript('');
      recognition.start();
    }
    setIsRecording(!isRecording);
  }, [isRecording, recognition]);

  const saveNote = async () => {
    if (!transcript.trim() || !user) return;

    try {
      await addDoc(collection(db, 'notes'), {
        text: transcript.trim(),
        timestamp: new Date(),
        tags: [],
        userId: user.uid,
      });
      setTranscript('');
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'notes', noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNote(note.id);
    setEditText(note.text);
  };

  const saveEdit = async (noteId: string) => {
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        text: editText,
      });
      setEditingNote(null);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const addTag = async (noteId: string, tag: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note || !tag.trim()) return;

    const newTags = [...new Set([...note.tags, tag.trim()])];
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        tags: newTags,
      });
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const exportNotes = () => {
    const exportData = notes.map(note => ({
      text: note.text,
      timestamp: note.timestamp.toISOString(),
      tags: note.tags,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-notes-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    let yOffset = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const lineHeight = 7;
    const margin = 20;
    const maxWidth = pdf.internal.pageSize.width - 2 * margin;

    pdf.setFontSize(20);
    pdf.text('Voice Notes', margin, yOffset);
    yOffset += lineHeight * 2;

    pdf.setFontSize(12);
    filteredNotes.forEach((note) => {
      // Add page if needed
      if (yOffset > pageHeight - margin) {
        pdf.addPage();
        yOffset = margin;
      }

      // Add timestamp
      const date = formatDistanceToNow(note.timestamp, { addSuffix: true });
      pdf.setTextColor(128);
      pdf.text(date, margin, yOffset);
      yOffset += lineHeight;

      // Add note text
      pdf.setTextColor(0);
      const splitText = pdf.splitTextToSize(note.text, maxWidth);
      pdf.text(splitText, margin, yOffset);
      yOffset += lineHeight * splitText.length;

      // Add tags
      if (note.tags.length > 0) {
        pdf.setTextColor(0, 0, 255);
        pdf.text(note.tags.map(tag => `#${tag}`).join(' '), margin, yOffset);
        yOffset += lineHeight * 2;
      } else {
        yOffset += lineHeight;
      }
    });

    pdf.save(`voice-notes-${new Date().toISOString()}.pdf`);
  };

  const handleLogout = () => {
    const auth = getAuth();
    auth.signOut();
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || note.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const getWordCount = (text: string) => text.trim().split(/\s+/).length;
  const getCharCount = (text: string) => text.length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <LoginPage onLogin={() => {}} />;
  }

  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          Speech recognition is not supported in your browser. Please use Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-100'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Voice Notes</h1>
          <div className="flex gap-4 items-center">
            <span className="text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Logout"
            >
              Logout
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={exportNotes}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Export Notes"
            >
              <Download size={20} />
            </button>
            <button
              onClick={exportPDF}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Export as PDF"
            >
              <FileText size={20} />
            </button>
          </div>
        </div>

        <div className={`rounded-lg shadow-lg p-6 mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex gap-4 mb-4">
            <button
              onClick={toggleRecording}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <button
              onClick={saveNote}
              disabled={!transcript.trim()}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className={`w-full h-32 p-4 border rounded-lg resize-none ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
            }`}
            placeholder="Your voice will be transcribed here..."
          />
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Words: {getWordCount(transcript)} | Characters: {getCharCount(transcript)}
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full p-2 rounded-lg border ${
                darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
              }`}
            />
          </div>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className={`p-2 rounded-lg border ${
              darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <option value="">All Tags</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <div key={note.id} className={`rounded-lg shadow-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(note.timestamp, { addSuffix: true })}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(note)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              {editingNote === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${
                      darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                    }`}
                  />
                  <button
                    onClick={() => saveEdit(note.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save size={16} />
                    Save
                  </button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{note.text}</p>
              )}
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {note.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      #{tag}
                    </span>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addTag(note.id, e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className={`px-2 py-1 text-sm rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    />
                    <Hash size={16} className="text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}