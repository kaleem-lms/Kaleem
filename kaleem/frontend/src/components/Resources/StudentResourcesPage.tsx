import {
  Calendar,
  ExternalLink,
  FileIcon as FilePresentation,
  FileText,
  Search,
  Video,
  BookOpen,
  Download,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { Resource } from "@/types"
import { getStrudentResources } from "@/api/axios"


const getResourceIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "document":
      return <FileText className="h-4 w-4" />
    case "video":
      return <Video className="h-4 w-4" />
    case "file":
      return <FilePresentation className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

export default function StudentResourcesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const data = await getStrudentResources()
        setResources(data)
      } catch (error) {
        console.error("Failed to fetch resources:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [])

  const handleViewResource = (resource: Resource) => {
    setSelectedResource(resource)
    setViewDialogOpen(true)
  }

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || resource.category.toLowerCase() === categoryFilter.toLowerCase()
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(resources.map((r) => r.category))]

  if (loading) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your resources...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="font-bold text-3xl tracking-tight">My Resources</h2>
            <p className="text-muted-foreground">Access your assigned learning materials and resources</p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
              <div className="relative flex-1">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category.toLowerCase()}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resources Grid */}
        {filteredResources.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <Card key={resource.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {resource.category}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getResourceIcon(resource.resource_type)}
                      <span className="text-xs text-muted-foreground capitalize">{resource.resource_type}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg leading-tight">{resource.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-4 line-clamp-2">{resource.description}</CardDescription>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(resource.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewResource(resource)}>
                        View Details
                      </Button>
                      {resource.file && (
                        <Button size="sm" asChild>
                          <a href={resource.file} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Open
                          </a>
                        </Button>
                      )}
                      {resource.video_url && (
                        <Button size="sm" asChild>
                          <a href={resource.video_url} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-1" />
                            Watch
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No resources found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || categoryFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "No resources have been assigned to you yet"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Resource Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedResource?.title}
              </DialogTitle>
              <DialogDescription>Resource details and access options</DialogDescription>
            </DialogHeader>
            {selectedResource && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Category</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{selectedResource.category}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getResourceIcon(selectedResource.resource_type)}
                      <Badge variant="outline" className="capitalize">
                        {selectedResource.resource_type}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedResource.description}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date Added
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(selectedResource.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <Separator />

                <div className="flex flex-col space-y-3">
                  <Label className="text-sm font-medium">Access Resource</Label>
                  <div className="flex space-x-3">
                    {selectedResource.file && (
                      <Button asChild className="flex-1">
                        <a href={selectedResource.file} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open File
                        </a>
                      </Button>
                    )}
                    {selectedResource.video_url && (
                      <Button asChild className="flex-1">
                        <a href={selectedResource.video_url} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2" />
                          Watch Video
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
